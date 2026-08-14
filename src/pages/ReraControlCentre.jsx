import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '@/api/api';
import { useAuth } from '@/context/AuthContext';
import { useSitePolicy } from '@/hooks/useSitePolicy';
import { Button } from '@/components/ui/button';
import { EmptyBlock, PageHeader } from '@/components/ui/page';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PolicyNotice } from '@/components/policy/PolicyNotice';
import ReraOverview from '@/components/rera/ReraOverview';
import ReraProjectsPhases from '@/components/rera/ReraProjectsPhases';
import ReraStakeholders from '@/components/rera/ReraStakeholders';
import ReraApprovalsEvidence from '@/components/rera/ReraApprovalsEvidence';
import ReraActivity from '@/components/rera/ReraActivity';
import {
  ReraStatus,
  WorkspaceError,
  WorkspaceLoading,
} from '@/components/rera/ReraUi';
import {
  asList,
  firstValue,
  readable,
  recordId,
} from '@/components/rera/reraUtils';

const EMPTY_WORKSPACE = {
  projects: [],
  selected_project: null,
  phases: [],
  summary: {},
  attention: [],
  requirements: [],
  approvals: [],
  stakeholders: [],
  stakeholder_catalog: [],
  evidence: [],
  upcoming: [],
  activity: [],
};

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'projects-phases', label: 'Projects & Phases' },
  { value: 'stakeholders', label: 'Stakeholders' },
  { value: 'approvals-evidence', label: 'Approvals & Evidence' },
  { value: 'activity', label: 'Activity' },
];

const normalizeWorkspace = (data) => ({
  ...EMPTY_WORKSPACE,
  ...(data && typeof data === 'object' ? data : {}),
  projects: asList(data?.projects),
  phases: asList(data?.phases),
  attention: asList(data?.attention),
  requirements: asList(data?.requirements),
  approvals: asList(data?.approvals),
  stakeholders: asList(data?.stakeholders),
  stakeholder_catalog: asList(data?.stakeholder_catalog),
  evidence: asList(data?.evidence),
  upcoming: asList(data?.upcoming),
  activity: asList(data?.activity),
  summary: data?.summary && typeof data.summary === 'object' ? data.summary : {},
});

export default function ReraControlCentre() {
  const { currentSite, hasPermission, isAdmin } = useAuth();
  const { canUseCapability, getTerm } = useSitePolicy();
  const [searchParams, setSearchParams] = useSearchParams();
  const siteId = currentSite?.id === null || currentSite?.id === undefined ? null : String(currentSite.id);
  const isReraWorkspace = canUseCapability('rera_workspace');
  const projectTerm = getTerm('project', isReraWorkspace ? 'RERA Project' : 'Development Project');
  const projectPlural = `${projectTerm}s`;
  const workspaceTitle = getTerm('compliance_workspace', isReraWorkspace ? 'RERA Control Centre' : 'Development Control Centre');
  const defaultTab = isReraWorkspace ? 'overview' : 'projects-phases';
  const [tabSelection, setTabSelection] = useState({ siteId: null, value: 'overview' });
  const [selection, setSelection] = useState({ siteId: null, projectId: '' });
  const [requestState, setRequestState] = useState({
    scope: '',
    data: EMPTY_WORKSPACE,
    loading: false,
    error: '',
  });
  const [reloadKey, setReloadKey] = useState(0);
  const requestSequence = useRef(0);

  const selectedProjectId = selection.siteId === siteId ? selection.projectId : '';
  const requestedScope = siteId ? `${siteId}:${selectedProjectId || 'default'}` : '';
  const scopeMatches = requestState.scope === requestedScope;
  const workspace = scopeMatches ? requestState.data : EMPTY_WORKSPACE;
  const displayLoading = Boolean(siteId) && (!scopeMatches || requestState.loading);
  const displayError = scopeMatches ? requestState.error : '';
  const canWrite = hasPermission('rera_projects', 'write');
  const canUpdate = hasPermission('rera_projects', 'update');
  const canDelete = hasPermission('rera_projects', 'delete');
  const canReadApprovals = canUseCapability('approval_register') && hasPermission('rera_approvals', 'read');
  const canWriteApprovals = canReadApprovals && hasPermission('rera_approvals', 'write');
  const canUpdateApprovals = canReadApprovals && hasPermission('rera_approvals', 'update');
  const canReadEvidence = canUseCapability('evidence_vault') && hasPermission('rera_evidence', 'read');
  const canWriteEvidence = canReadEvidence && hasPermission('rera_evidence', 'write');
  const availableTabs = useMemo(() => {
    const workspaceTabs = isReraWorkspace
      ? TABS
      : TABS.filter((tab) => tab.value === 'projects-phases');

    return workspaceTabs
      .filter((tab) => tab.value !== 'approvals-evidence' || canReadApprovals || canReadEvidence)
      .map((tab) => (tab.value === 'projects-phases'
        ? { ...tab, label: `${projectPlural} & phases` }
        : tab));
  }, [canReadApprovals, canReadEvidence, isReraWorkspace, projectPlural]);
  const routeTab = searchParams.get('tab');
  const requestedTab = routeTab || (tabSelection.siteId === siteId ? tabSelection.value : defaultTab);
  const activeTab = availableTabs.some((tab) => tab.value === requestedTab) ? requestedTab : defaultTab;
  const setActiveTab = useCallback((value) => {
    setTabSelection({ siteId, value });
    const next = new URLSearchParams(searchParams);
    if (value === defaultTab) next.delete('tab');
    else next.set('tab', value);
    next.delete('create');
    setSearchParams(next, { replace: true });
  }, [defaultTab, searchParams, setSearchParams, siteId]);
  const createProjectRequestKey = searchParams.get('create') === 'project' ? `${siteId}:${searchParams.get('create')}` : '';
  const consumeCreateProjectRequest = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!siteId) {
      requestSequence.current += 1;
      return undefined;
    }

    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    const scope = requestedScope;

    const loadWorkspace = async () => {
      setRequestState((current) => ({
        scope,
        data: current.scope === scope ? current.data : EMPTY_WORKSPACE,
        loading: true,
        error: '',
      }));
      try {
        const { data } = await api.get('/rera/control-centre', {
          params: {
            site_id: siteId,
            ...(selectedProjectId ? { project_id: selectedProjectId } : {}),
          },
          signal: controller.signal,
        });
        if (sequence === requestSequence.current) {
          setRequestState({
            scope,
            data: normalizeWorkspace(data),
            loading: false,
            error: '',
          });
        }
      } catch (requestError) {
        if (requestError?.code !== 'ERR_CANCELED' && sequence === requestSequence.current) {
          setRequestState((current) => ({
            scope,
            data: current.scope === scope ? current.data : EMPTY_WORKSPACE,
            loading: false,
            error: requestError.response?.data?.message || `The ${workspaceTitle} could not be loaded for this Site.`,
          }));
        }
      }
    };

    loadWorkspace();

    return () => controller.abort();
  }, [reloadKey, requestedScope, selectedProjectId, siteId, workspaceTitle]);

  const projects = workspace.projects;
  const selectedProject = useMemo(() => {
    if (workspace.selected_project) return workspace.selected_project;
    if (!selectedProjectId) return null;
    return projects.find((project) => String(recordId(project)) === String(selectedProjectId)) ?? null;
  }, [projects, selectedProjectId, workspace.selected_project]);
  const effectiveProjectId = selectedProjectId || (recordId(selectedProject) ? String(recordId(selectedProject)) : '');

  const refresh = useCallback(() => setReloadKey((current) => current + 1), []);
  const handleChanged = useCallback((preferredProjectId) => {
    if (preferredProjectId && siteId) {
      setSelection({ siteId, projectId: String(preferredProjectId) });
    }
    setReloadKey((current) => current + 1);
  }, [siteId]);
  const handleProjectSelected = useCallback((projectId) => {
    if (!siteId || !projectId) return;
    setSelection({ siteId, projectId: String(projectId) });
  }, [siteId]);

  if (!siteId) {
    return (
      <div className="mx-auto w-full max-w-7xl py-10">
        <EmptyBlock
          icon={Building2}
          title="Select a Site"
          description={`${workspaceTitle} is Site-scoped. Select a Site to view its project records.`}
          tall
        />
      </div>
    );
  }

  const hasLoadedData = Boolean(selectedProject || projects.length || workspace.activity.length);
  if (displayLoading && !hasLoadedData) {
    return <div className="mx-auto w-full max-w-[1500px] pb-12"><WorkspaceLoading /></div>;
  }

  const regulatoryStatus = firstValue(selectedProject, ['regulatory_status', 'registration_status', 'status']);
  const registrationNumber = firstValue(selectedProject, ['registration_number', 'rera_number']);
  const authority = firstValue(selectedProject, ['authority', 'authority_name'], 'Not recorded');
  const ruleset = firstValue(selectedProject, ['ruleset_name', 'active_ruleset_name'])
    ?? firstValue(workspace.summary, ['ruleset_name', 'active_ruleset_name'], 'Not assigned');
  const statusLabel = String(regulatoryStatus ?? '').toUpperCase() === 'REGISTERED'
    ? (registrationNumber ? 'Registration recorded' : 'Registered status recorded')
    : readable(regulatoryStatus);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-12">
      <PageHeader
        title={workspaceTitle}
        description={selectedProject
          ? `${firstValue(selectedProject, ['name', 'project_name'], 'Selected project')} · ${currentSite?.name || 'Selected Site'}`
          : `${isReraWorkspace ? 'Regulatory' : 'Development'} project workspace for ${currentSite?.name || 'the selected Site'}.`}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {activeTab !== 'projects-phases' && <Select value={effectiveProjectId || undefined} onValueChange={handleProjectSelected} disabled={!projects.length}>
              <SelectTrigger className="h-10 min-w-[240px] rounded-control border-mr-line bg-mr-surface">
                <SelectValue placeholder={projects.length ? `Select ${projectTerm}` : `No ${projectPlural}`} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project, index) => {
                  const id = recordId(project);
                  return id ? <SelectItem key={`${id}-${index}`} value={String(id)}>{firstValue(project, ['name', 'project_name'], `Project ${id}`)}</SelectItem> : null;
                })}
              </SelectContent>
            </Select>}
            <Button type="button" variant="outline" size="icon" onClick={refresh} disabled={displayLoading} title="Refresh workspace">
              <RefreshCw className={displayLoading ? 'animate-spin' : ''} />
              <span className="sr-only">Refresh workspace</span>
            </Button>
          </div>
        )}
      />

      {displayError && hasLoadedData && <PolicyNotice variant="attention" title="Some project information could not be refreshed" action={<Button type="button" variant="outline" size="sm" onClick={refresh}>Try again</Button>}>{displayError}</PolicyNotice>}
      {displayError && !hasLoadedData && <WorkspaceError message={displayError} onRetry={refresh} />}

      {isReraWorkspace ? (
        <section className="grid gap-x-7 gap-y-4 border-y border-mr-line py-4 sm:grid-cols-2 xl:grid-cols-4">
          <HeaderFact label="Regulatory status">
            {regulatoryStatus ? <ReraStatus value={regulatoryStatus} label={statusLabel} /> : 'Not recorded'}
          </HeaderFact>
          <HeaderFact label="Authority" value={authority} />
          <HeaderFact label="Registration number" value={registrationNumber || 'Not recorded'} />
          <HeaderFact label="Current ruleset" value={ruleset} />
        </section>
      ) : (
        <section className="grid gap-x-7 gap-y-4 border-y border-mr-line py-4 sm:grid-cols-2 xl:grid-cols-4">
          <HeaderFact label="Project status" value={readable(regulatoryStatus) || 'Draft'} />
          <HeaderFact label="Project type" value={readable(firstValue(selectedProject, ['project_shape', 'project_type'])) || 'Not recorded'} />
          <HeaderFact label="Development basis" value={readable(firstValue(selectedProject, ['development_basis'])) || 'Not recorded'} />
          <HeaderFact label="Planned completion" value={readable(firstValue(selectedProject, ['proposed_completion_date', 'committed_completion_date'])) || 'Not recorded'} />
        </section>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto border-b border-mr-line">
          <TabsList className="h-auto min-w-max justify-start rounded-none bg-transparent p-0">
            {availableTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="-mb-px rounded-none border-b-2 border-transparent px-4 py-3 text-[13px] text-mr-muted shadow-none data-[state=active]:border-mr-ink data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-mr-text data-[state=active]:shadow-none"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-5">
          <ReraOverview data={workspace} project={selectedProject} onNavigate={setActiveTab} />
        </TabsContent>
        <TabsContent value="projects-phases" className="mt-5">
          <ReraProjectsPhases
            siteId={siteId}
            projects={projects}
            selectedProject={selectedProject}
            phases={workspace.phases}
            canWrite={canWrite}
            canUpdate={canUpdate}
            onProjectSelected={handleProjectSelected}
            onChanged={handleChanged}
            createProjectRequestKey={createProjectRequestKey}
            onCreateProjectRequestConsumed={consumeCreateProjectRequest}
            projectTerm={projectTerm}
            isReraWorkspace={isReraWorkspace}
          />
        </TabsContent>
        <TabsContent value="stakeholders" className="mt-5">
          <ReraStakeholders
            siteId={siteId}
            project={selectedProject}
            phases={workspace.phases}
            stakeholders={workspace.stakeholders}
            stakeholderCatalog={workspace.stakeholder_catalog}
            canWrite={canWrite}
            canUpdate={canUpdate}
            canDelete={canDelete}
            onChanged={handleChanged}
          />
        </TabsContent>
        <TabsContent value="approvals-evidence" className="mt-5">
          <ReraApprovalsEvidence
            siteId={siteId}
            project={selectedProject}
            phases={workspace.phases}
            approvals={workspace.approvals}
            evidence={workspace.evidence}
            canReadApprovals={canReadApprovals}
            canWriteApprovals={canWriteApprovals}
            canUpdateApprovals={canUpdateApprovals}
            canReviewApprovals={isAdmin && canUpdateApprovals}
            canReadEvidence={canReadEvidence}
            canWriteEvidence={canWriteEvidence}
            onChanged={handleChanged}
          />
        </TabsContent>
        <TabsContent value="activity" className="mt-5">
          <ReraActivity project={selectedProject} activity={workspace.activity} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HeaderFact({ label, value, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-mr-faint">{label}</p>
      <div className="mt-1.5 truncate text-[13px] font-medium text-mr-text">{children ?? value ?? 'Not recorded'}</div>
    </div>
  );
}
