import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from './graphql/client';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { DocViewerProvider } from './components/DocViewer';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Pricing from './pages/Pricing';
import Legal from './pages/Legal';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Subscription from './pages/Subscription';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import MemberKycPage from './pages/MemberKycPage';
import FinanceForecast from './pages/FinanceForecast';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Sites from './pages/Sites';
import SubAdmins from './pages/SubAdmins';
import Farmers from './pages/Farmers';
import FarmerPayments from './pages/FarmerPayments';
import Commissions from './pages/Commissions';
import CreateCommission from './pages/CreateCommission';
import PlotCommissionList from './pages/PlotCommissionList';
import PlotCommissionDetail from './pages/PlotCommissionDetail';
import PlotCommissionSearch from './pages/PlotCommissionSearch';
import CashFlow from './pages/CashFlow';
import CashFlowAnalytics from './pages/CashFlowAnalytics';
import FirmTransactions from './pages/FirmTransactions';
import FirmDetail from './pages/FirmDetail';
import FirmTransactionHistory from './pages/FirmTransactionHistory';
import PlotPayments from './pages/PlotPayments';
import PaymentManagement from './pages/PaymentManagement';
import PaymentManagementPlots from './pages/PaymentManagementPlots';
import PaymentReminders from './pages/PaymentReminders';
import PaymentAnalytics from './pages/PaymentAnalytics';
import Construction from './pages/Construction';
import Inventory from './pages/Inventory';
import PlotDetail from './pages/PlotDetail';
import PlotDocuments from './pages/PlotDocuments';
import PlotDocumentDetail from './pages/PlotDocumentDetail';
import PlotRegistry from './pages/PlotRegistry';
import PlotRegistryDocuments from './pages/PlotRegistryDocuments';
import Documents from './pages/Documents';
import PlotRegistryNoc from './pages/PlotRegistryNoc';
import PlotRegistryNocPrint from './pages/PlotRegistryNocPrint';
import Expenses from './pages/Expenses';
import EditApprovals from './pages/EditApprovals';
import AdminApprovals from './pages/AdminApprovals';
import PendingApprovals from './pages/PendingApprovals';
import DayBook from './pages/DayBook';
import ImprestManagement from './pages/ImprestManagement';
import ImprestDashboard from './pages/ImprestDashboard';
import DocumentImprest from './pages/DocumentImprest';
import ReceivePayments from './pages/ReceivePayments';
import BankConfigs from './pages/BankConfigs';
import QrDisplay from './pages/QrDisplay';
import PermissionManagement from './pages/PermissionManagement';
import RegisterUser from './pages/RegisterUser';
import UserCategories from './pages/UserCategories';
import ExpenseCategories from './pages/ExpenseCategories';
import ExcelEditor from './pages/ExcelEditor';
import ExcelFiles from './pages/ExcelFiles';
import Chat from './pages/Chat';
import VendorManagement from './pages/VendorManagement';
import VendorCommitmentDetail from './pages/VendorCommitmentDetail';
import VendorInventoryDetail from './pages/VendorInventoryDetail';
import VendorPaymentReceiptPrint from './pages/VendorPaymentReceiptPrint';
import VendorCategories from './pages/VendorCategories';
import UserIdManagement from './pages/UserIdManagement';
import ApprovalManager from './pages/ApprovalManager';
import DashboardManagement from './pages/DashboardManagement';
import BalanceSheet from './pages/BalanceSheet';
import ComplianceLegal from './pages/ComplianceLegal';
import ComplianceItemDetail from './pages/ComplianceItemDetail';
import LegalCaseDetail from './pages/LegalCaseDetail';
import LegalNoticeDetail from './pages/LegalNoticeDetail';
import './App.css';
import './fonts.css';

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
        <DocViewerProvider>
        <ScrollToTop />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
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
            <Route path="/farmers" element={<ProtectedRoute requiredModule="farmers"><Farmers /></ProtectedRoute>} />
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
            <Route path="/plot-payments/:id" element={<ProtectedRoute requiredModule="plot_payments"><PlotDetail /></ProtectedRoute>} />
            <Route path="/plot-documents" element={<ProtectedRoute requiredModule="plot_payments"><PlotDocuments /></ProtectedRoute>} />
            <Route path="/plot-documents/:plotId" element={<ProtectedRoute requiredModule="plot_payments"><PlotDocumentDetail /></ProtectedRoute>} />
            <Route path="/payment-management" element={<ProtectedRoute requiredModule="plot_payments"><PaymentManagement /></ProtectedRoute>} />
            <Route path="/payment-management/plots" element={<ProtectedRoute requiredModule="plot_payments"><PaymentManagementPlots /></ProtectedRoute>} />
            <Route path="/payment-management/reminders" element={<ProtectedRoute requiredModule="plot_payments"><PaymentReminders /></ProtectedRoute>} />
            <Route path="/payment-analytics" element={<ProtectedRoute requiredModule="plot_payments"><PaymentAnalytics /></ProtectedRoute>} />
            <Route path="/construction" element={<ProtectedRoute requiredModule="construction"><Construction /></ProtectedRoute>} />
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
            <Route path="/bank-configs" element={<ProtectedRoute requiredModule="upi_collect"><BankConfigs /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute requiredModule="reports"><Reports /></ProtectedRoute>} />
            <Route path="/finance-forecast" element={<ProtectedRoute requiredModule="finance_forecast"><FinanceForecast /></ProtectedRoute>} />
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
            <Route path="/settings" element={<ProtectedRoute requiredModule="settings"><Settings /></ProtectedRoute>} />
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
        </DocViewerProvider>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </Router>
    </ApolloProvider>
  );
}

export default App;
