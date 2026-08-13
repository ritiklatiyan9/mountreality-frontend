import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from './graphql/client';
import { AuthProvider } from './context/AuthContext';
import { SitePolicyProvider } from './context/SitePolicyContext';
import ProtectedRoute from './components/ProtectedRoute';
import { DocViewerProvider } from './components/DocViewer';
import SitePolicyDeniedNotifier from './components/SitePolicyDeniedDialog';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Pricing from './pages/Pricing';
import Legal from './pages/Legal';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Subscription from './pages/Subscription';
import './App.css';
import './fonts.css';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Home = lazy(() => import('./pages/Home.jsx'));
const Clients = lazy(() => import('./pages/Clients.jsx'));
const ClientDetail = lazy(() => import('./pages/ClientDetail.jsx'));
const MemberKycPage = lazy(() => import('./pages/MemberKycPage.jsx'));
const FinanceForecast = lazy(() => import('./pages/FinanceForecast.jsx'));
const Reports = lazy(() => import('./pages/Reports.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const ReceiptDesigner = lazy(() => import('./pages/ReceiptDesigner.jsx'));
const Sites = lazy(() => import('./pages/Sites.jsx'));
const SubAdmins = lazy(() => import('./pages/SubAdmins.jsx'));
const FarmerPayments = lazy(() => import('./pages/FarmerPayments.jsx'));
const LandAcquisition = lazy(() => import('./pages/LandAcquisition.jsx'));
const LandAcquisitionDetail = lazy(() => import('./pages/LandAcquisitionDetail.jsx'));
const Commissions = lazy(() => import('./pages/Commissions.jsx'));
const CreateCommission = lazy(() => import('./pages/CreateCommission.jsx'));
const PlotCommissionList = lazy(() => import('./pages/PlotCommissionList.jsx'));
const PlotCommissionDetail = lazy(() => import('./pages/PlotCommissionDetail.jsx'));
const PlotCommissionSearch = lazy(() => import('./pages/PlotCommissionSearch.jsx'));
const CashFlow = lazy(() => import('./pages/CashFlow.jsx'));
const CashFlowAnalytics = lazy(() => import('./pages/CashFlowAnalytics.jsx'));
const FirmTransactions = lazy(() => import('./pages/FirmTransactions.jsx'));
const FirmDetail = lazy(() => import('./pages/FirmDetail.jsx'));
const FirmTransactionHistory = lazy(() => import('./pages/FirmTransactionHistory.jsx'));
const PlotPayments = lazy(() => import('./pages/PlotPayments.jsx'));
const PaymentManagement = lazy(() => import('./pages/PaymentManagement.jsx'));
const PaymentManagementPlots = lazy(() => import('./pages/PaymentManagementPlots.jsx'));
const PaymentReminders = lazy(() => import('./pages/PaymentReminders.jsx'));
const PaymentAnalytics = lazy(() => import('./pages/PaymentAnalytics.jsx'));
const Construction = lazy(() => import('./pages/Construction.jsx'));
const Inventory = lazy(() => import('./pages/Inventory.jsx'));
const PlotDetail = lazy(() => import('./pages/PlotDetail.jsx'));
const PlotDocuments = lazy(() => import('./pages/PlotDocuments.jsx'));
const PlotDocumentDetail = lazy(() => import('./pages/PlotDocumentDetail.jsx'));
const PlotRegistry = lazy(() => import('./pages/PlotRegistry.jsx'));
const PlotRegistryDocuments = lazy(() => import('./pages/PlotRegistryDocuments.jsx'));
const Documents = lazy(() => import('./pages/Documents.jsx'));
const PlotRegistryNoc = lazy(() => import('./pages/PlotRegistryNoc.jsx'));
const PlotRegistryNocPrint = lazy(() => import('./pages/PlotRegistryNocPrint.jsx'));
const Expenses = lazy(() => import('./pages/Expenses.jsx'));
const EditApprovals = lazy(() => import('./pages/EditApprovals.jsx'));
const AdminApprovals = lazy(() => import('./pages/AdminApprovals.jsx'));
const PendingApprovals = lazy(() => import('./pages/PendingApprovals.jsx'));
const DayBook = lazy(() => import('./pages/DayBook.jsx'));
const ImprestManagement = lazy(() => import('./pages/ImprestManagement.jsx'));
const ImprestDashboard = lazy(() => import('./pages/ImprestDashboard.jsx'));
const DocumentImprest = lazy(() => import('./pages/DocumentImprest.jsx'));
const ReceivePayments = lazy(() => import('./pages/ReceivePayments.jsx'));
const BankConfigs = lazy(() => import('./pages/BankConfigs.jsx'));
const BankAccountDetail = lazy(() => import('./pages/BankAccountDetail.jsx'));
const QrDisplay = lazy(() => import('./pages/QrDisplay.jsx'));
const PermissionManagement = lazy(() => import('./pages/PermissionManagement.jsx'));
const RegisterUser = lazy(() => import('./pages/RegisterUser.jsx'));
const UserCategories = lazy(() => import('./pages/UserCategories.jsx'));
const ExpenseCategories = lazy(() => import('./pages/ExpenseCategories.jsx'));
const ExcelEditor = lazy(() => import('./pages/ExcelEditor.jsx'));
const ExcelFiles = lazy(() => import('./pages/ExcelFiles.jsx'));
const Chat = lazy(() => import('./pages/Chat.jsx'));
const VendorManagement = lazy(() => import('./pages/VendorManagement.jsx'));
const VendorCommitmentDetail = lazy(() => import('./pages/VendorCommitmentDetail.jsx'));
const VendorInventoryDetail = lazy(() => import('./pages/VendorInventoryDetail.jsx'));
const VendorPaymentReceiptPrint = lazy(() => import('./pages/VendorPaymentReceiptPrint.jsx'));
const VendorCategories = lazy(() => import('./pages/VendorCategories.jsx'));
const UserIdManagement = lazy(() => import('./pages/UserIdManagement.jsx'));
const ApprovalManager = lazy(() => import('./pages/ApprovalManager.jsx'));
const DashboardManagement = lazy(() => import('./pages/DashboardManagement.jsx'));
const BalanceSheet = lazy(() => import('./pages/BalanceSheet.jsx'));
const ComplianceLegal = lazy(() => import('./pages/ComplianceLegal.jsx'));
const ReraControlCentre = lazy(() => import('./pages/ReraControlCentre.jsx'));
const ComplianceItemDetail = lazy(() => import('./pages/ComplianceItemDetail.jsx'));
const LegalCaseDetail = lazy(() => import('./pages/LegalCaseDetail.jsx'));
const LegalNoticeDetail = lazy(() => import('./pages/LegalNoticeDetail.jsx'));
const CustomerInventory = lazy(() => import('./pages/CustomerInventory'));
const ProjectFinance = lazy(() => import('./pages/ProjectFinance'));
const PortalAccept = lazy(() => import('./pages/PortalAccept'));
const PortalWorkspace = lazy(() => import('./pages/PortalWorkspace'));
const EcosystemControlCentre = lazy(() => import('./pages/EcosystemControlCentre'));
const ConstructionGovernance = lazy(() => import('./pages/ConstructionGovernance'));
const LazyRouteFallback = () => <div className="mx-auto max-w-7xl space-y-3 px-6 py-8"><div className="h-7 w-56 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" /><div className="h-12 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" /><div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white motion-reduce:animate-none" /></div>;

/* Route changes must start at the top of the page. Without this, clicking a
   CTA from far down the landing page renders the next route at the same
   scroll offset. Skipped when the browser is restoring a history entry. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (window.history.scrollRestoration) window.history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  return (
    <ApolloProvider client={apolloClient}>
    <Router>
      <AuthProvider>
        <SitePolicyProvider>
        <DocViewerProvider>
        <ScrollToTop />
        <Suspense fallback={<LazyRouteFallback />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/portal/accept" element={<Suspense fallback={<LazyRouteFallback />}><PortalAccept /></Suspense>} />
          {/* Public policy pages — one component, one route each (footer links here). */}
          <Route path="/terms" element={<Legal />} />
          <Route path="/privacy" element={<Legal />} />
          <Route path="/refund" element={<Legal />} />
          <Route path="/shipping" element={<Legal />} />
          <Route path="/contact" element={<Legal />} />
          <Route
            path="/vendors/payments/:paymentId/receipt"
            element={<ProtectedRoute requiredModule="vendors"><VendorPaymentReceiptPrint /></ProtectedRoute>}
          />
          <Route
            path="/plot-registry/:id/noc/print"
            element={<ProtectedRoute requiredModule="plot_registry"><PlotRegistryNocPrint /></ProtectedRoute>}
          />
          {/* Fullscreen connected-screen QR display (no sidebar/layout) */}
          <Route
            path="/qr-display"
            element={<ProtectedRoute requiredModule="upi_collect"><QrDisplay /></ProtectedRoute>}
          />
          <Route
            path="/portal"
            element={<ProtectedRoute><Suspense fallback={<LazyRouteFallback />}><PortalWorkspace /></Suspense></ProtectedRoute>}
          />

          {/* Protected Routes (all authenticated users) */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<ProtectedRoute requiredModule="dashboard"><Dashboard /></ProtectedRoute>} />
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute requiredModule="clients"><Clients /></ProtectedRoute>} />
            <Route path="/clients/:id/kyc" element={<ProtectedRoute requiredModule="clients"><MemberKycPage /></ProtectedRoute>} />
            <Route path="/clients/:id" element={<ProtectedRoute requiredModule="clients"><ClientDetail /></ProtectedRoute>} />
            <Route path="/register-user" element={<ProtectedRoute requiredModule="clients"><RegisterUser /></ProtectedRoute>} />
            <Route path="/vendors" element={<ProtectedRoute requiredModule="vendors"><VendorManagement /></ProtectedRoute>} />
            {/* Old vendor sub-page — inventory is its own module now. */}
            <Route path="/vendors/inventory" element={<Navigate to="/inventory?tab=procurement" replace />} />
            <Route path="/vendors/inventory/:id" element={<ProtectedRoute requiredModule="vendors"><VendorInventoryDetail /></ProtectedRoute>} />
            <Route path="/vendors/categories" element={<ProtectedRoute requiredModule="vendors"><VendorCategories /></ProtectedRoute>} />
            <Route path="/vendors/:id" element={<ProtectedRoute requiredModule="vendors"><VendorCommitmentDetail /></ProtectedRoute>} />
            <Route path="/user-categories" element={<ProtectedRoute requiredRole="admin"><UserCategories /></ProtectedRoute>} />
            <Route path="/land-acquisition" element={<ProtectedRoute requiredModule="farmers"><LandAcquisition /></ProtectedRoute>} />
            <Route path="/land-acquisition/:id" element={<ProtectedRoute requiredModule="farmers"><LandAcquisitionDetail /></ProtectedRoute>} />
            <Route path="/farmers" element={<Navigate to="/land-acquisition?view=acquisitions" replace />} />
            <Route path="/farmers/:id" element={<ProtectedRoute requiredModule="farmers"><FarmerPayments /></ProtectedRoute>} />
            <Route path="/commissions" element={<ProtectedRoute requiredModule="commissions"><Commissions /></ProtectedRoute>} />
            <Route path="/commissions/create" element={<ProtectedRoute requiredModule="commissions"><CreateCommission /></ProtectedRoute>} />
            <Route path="/plot-commission" element={<ProtectedRoute requiredModule="commissions"><PlotCommissionList /></ProtectedRoute>} />
            <Route path="/plot-commission/search" element={<ProtectedRoute requiredModule="commissions"><PlotCommissionSearch /></ProtectedRoute>} />
            <Route path="/plot-commission/plot/:plotId" element={<ProtectedRoute requiredModule="commissions"><PlotCommissionDetail /></ProtectedRoute>} />
            <Route path="/plot-commission/:id" element={<ProtectedRoute requiredModule="commissions"><PlotCommissionDetail /></ProtectedRoute>} />
            <Route path="/daybook" element={<ProtectedRoute requiredModule="daybook"><DayBook /></ProtectedRoute>} />
            <Route path="/daybook/cash" element={<ProtectedRoute requiredModule="daybook"><DayBook /></ProtectedRoute>} />
            <Route path="/daybook/bank" element={<ProtectedRoute requiredModule="daybook"><DayBook /></ProtectedRoute>} />
            <Route path="/balance-sheet" element={<ProtectedRoute requiredModule="balance_sheet"><BalanceSheet /></ProtectedRoute>} />
            <Route path="/balance-sheet/cash" element={<ProtectedRoute requiredModule="balance_sheet"><BalanceSheet /></ProtectedRoute>} />
            <Route path="/balance-sheet/bank" element={<ProtectedRoute requiredModule="balance_sheet"><BalanceSheet /></ProtectedRoute>} />
            <Route path="/cashflow" element={<ProtectedRoute requiredModule="cashflow"><CashFlow /></ProtectedRoute>} />
            <Route path="/cashflow/analytics" element={<ProtectedRoute requiredModule="cashflow"><CashFlowAnalytics /></ProtectedRoute>} />
            <Route path="/cashflow/:ledgerId" element={<ProtectedRoute requiredModule="cashflow"><CashFlow /></ProtectedRoute>} />
            <Route path="/firm-transactions" element={<ProtectedRoute requiredModule="firm_transactions"><FirmTransactions /></ProtectedRoute>} />
            <Route path="/firm-transactions/history" element={<ProtectedRoute requiredModule="firm_transactions"><FirmTransactionHistory /></ProtectedRoute>} />
            <Route path="/firm-transactions/:id" element={<ProtectedRoute requiredModule="firm_transactions"><FirmDetail /></ProtectedRoute>} />
            <Route path="/plot-payments" element={<ProtectedRoute requiredModule="plot_payments"><PlotPayments /></ProtectedRoute>} />
            <Route path="/customer-inventory" element={<ProtectedRoute requiredModule="plot_payments"><Suspense fallback={<LazyRouteFallback />}><CustomerInventory /></Suspense></ProtectedRoute>} />
            <Route path="/project-finance" element={<ProtectedRoute requiredModule="plot_payments"><Suspense fallback={<LazyRouteFallback />}><ProjectFinance /></Suspense></ProtectedRoute>} />
            <Route path="/plot-payments/:id" element={<ProtectedRoute requiredModule="plot_payments"><PlotDetail /></ProtectedRoute>} />
            <Route path="/plot-documents" element={<ProtectedRoute requiredModule="plot_payments"><PlotDocuments /></ProtectedRoute>} />
            <Route path="/plot-documents/:plotId" element={<ProtectedRoute requiredModule="plot_payments"><PlotDocumentDetail /></ProtectedRoute>} />
            <Route path="/payment-management" element={<ProtectedRoute requiredModule="plot_payments"><PaymentManagement /></ProtectedRoute>} />
            <Route path="/payment-management/plots" element={<ProtectedRoute requiredModule="plot_payments"><PaymentManagementPlots /></ProtectedRoute>} />
            <Route path="/payment-management/reminders" element={<ProtectedRoute requiredModule="plot_payments"><PaymentReminders /></ProtectedRoute>} />
            <Route path="/payment-analytics" element={<ProtectedRoute requiredModule="plot_payments"><PaymentAnalytics /></ProtectedRoute>} />
            <Route path="/construction" element={<ProtectedRoute requiredModule="construction"><Construction /></ProtectedRoute>} />
            <Route path="/construction/governance" element={<ProtectedRoute requiredModule="construction"><Suspense fallback={<LazyRouteFallback />}><ConstructionGovernance /></Suspense></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute requiredModule="inventory"><Inventory /></ProtectedRoute>} />
            <Route path="/plot-registry" element={<ProtectedRoute requiredModule="plot_registry"><PlotRegistry /></ProtectedRoute>} />
            <Route path="/plot-registry/documents" element={<ProtectedRoute requiredModule="plot_registry"><PlotRegistryDocuments /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute requiredModule="document_search"><Documents /></ProtectedRoute>} />
            <Route path="/plot-registry/:id" element={<ProtectedRoute requiredModule="plot_registry"><PlotRegistry /></ProtectedRoute>} />
            <Route path="/plot-registry/:id/noc" element={<ProtectedRoute requiredModule="plot_registry"><PlotRegistryNoc /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute requiredModule="expenses"><Expenses /></ProtectedRoute>} />
            <Route path="/expense-categories" element={<ProtectedRoute requiredModule="expenses"><ExpenseCategories /></ProtectedRoute>} />
            <Route path="/imprest" element={<ProtectedRoute requiredModule="imprest"><ImprestDashboard /></ProtectedRoute>} />
            <Route path="/document-imprest" element={<ProtectedRoute requiredModule="document_imprest"><DocumentImprest /></ProtectedRoute>} />
            <Route path="/receive-payments" element={<ProtectedRoute requiredModule="upi_collect"><ReceivePayments /></ProtectedRoute>} />
            <Route path="/bank-configs" element={<ProtectedRoute requiredModule="plot_payments"><BankConfigs /></ProtectedRoute>} />
            <Route path="/bank-configs/:id" element={<ProtectedRoute requiredModule="plot_payments"><BankAccountDetail /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute requiredModule="reports"><Reports /></ProtectedRoute>} />
            <Route path="/finance-forecast" element={<ProtectedRoute requiredModule="finance_forecast"><FinanceForecast /></ProtectedRoute>} />
            <Route path="/rera" element={<ProtectedRoute requiredModule="rera_projects"><ReraControlCentre /></ProtectedRoute>} />
            <Route path="/compliance" element={<Navigate to="/compliance/dashboard" replace />} />
            <Route path="/compliance/dashboard" element={<ProtectedRoute requiredModule="compliance"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/compliance/my-tasks" element={<ProtectedRoute requiredModule="compliance"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/compliance/calendar" element={<ProtectedRoute requiredModule="compliance"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/compliance/register" element={<ProtectedRoute requiredModule="compliance"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/compliance/register/:id" element={<ProtectedRoute requiredModule="compliance"><ComplianceItemDetail /></ProtectedRoute>} />
            <Route path="/compliance/licences" element={<ProtectedRoute requiredModule="compliance"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/compliance/documents" element={<ProtectedRoute requiredModule="compliance"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/compliance/reports" element={<ProtectedRoute requiredModule="compliance"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/compliance/templates" element={<ProtectedRoute requiredModule="compliance_templates"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/compliance/filings" element={<ProtectedRoute requiredModule="compliance_templates"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/compliance/authorities" element={<ProtectedRoute requiredModule="compliance_settings"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/compliance/settings" element={<ProtectedRoute requiredModule="compliance_settings"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/legal/cases" element={<ProtectedRoute requiredModule="legal"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/legal/cases/:id" element={<ProtectedRoute requiredModule="legal"><LegalCaseDetail /></ProtectedRoute>} />
            <Route path="/legal/notices" element={<ProtectedRoute requiredModule="legal"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/legal/notices/:id" element={<ProtectedRoute requiredModule="legal"><LegalNoticeDetail /></ProtectedRoute>} />
            <Route path="/legal/hearings" element={<ProtectedRoute requiredModule="legal"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/legal/inspections" element={<ProtectedRoute requiredModule="compliance"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/legal/reports" element={<ProtectedRoute requiredModule="legal"><ComplianceLegal /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredAnyModule={['settings', 'operating_profile']}><Settings /></ProtectedRoute>} />
            <Route path="/settings/receipt" element={<ProtectedRoute requiredAnyModule={['settings', 'operating_profile']}><ReceiptDesigner /></ProtectedRoute>} />
            <Route path="/ecosystem" element={<ProtectedRoute requiredRole="admin"><Suspense fallback={<LazyRouteFallback />}><EcosystemControlCentre /></Suspense></ProtectedRoute>} />
            {/* Billing — reachable by every authenticated role (402 redirects land here) */}
            <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />

            {/* Native Excel Routes */}
            <Route path="/excel/new" element={<ProtectedRoute requiredModule="excel"><ExcelEditor /></ProtectedRoute>} />
            <Route path="/excel/edit/:id" element={<ProtectedRoute requiredModule="excel"><ExcelEditor /></ProtectedRoute>} />
            <Route path="/excel/files" element={<ProtectedRoute requiredModule="excel"><ExcelFiles /></ProtectedRoute>} />

            {/* Chat Route (accessible to all authenticated users) */}
            <Route path="/chat" element={<ProtectedRoute requiredModule="chat"><Chat /></ProtectedRoute>} />
            <Route path="/chat/:id" element={<ProtectedRoute requiredModule="chat"><Chat /></ProtectedRoute>} />

            {/* Admin-only Routes */}
            <Route
              path="/sites"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Sites />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sub-admins"
              element={
                <ProtectedRoute requiredRole="admin">
                  <SubAdmins />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expense-approvals"
              element={
                <ProtectedRoute requiredModule="expense_approval">
                  <AdminApprovals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/approval-manager"
              element={
                <ProtectedRoute requiredRole="admin">
                  <ApprovalManager />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit-approvals"
              element={
                <ProtectedRoute requiredRole="admin">
                  <EditApprovals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pending-approvals"
              element={
                <ProtectedRoute requiredRole="admin">
                  <PendingApprovals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/imprest-management"
              element={
                <ProtectedRoute requiredRole="admin">
                  <ImprestManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/permissions"
              element={
                <ProtectedRoute requiredRole="admin">
                  <PermissionManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/user-id-management"
              element={
                <ProtectedRoute requiredRole="admin">
                  <UserIdManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard-management"
              element={
                <ProtectedRoute requiredRole="admin">
                  <DashboardManagement />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        <SitePolicyDeniedNotifier />
        </DocViewerProvider>
        </SitePolicyProvider>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </Router>
    </ApolloProvider>
  );
}

export default App;
