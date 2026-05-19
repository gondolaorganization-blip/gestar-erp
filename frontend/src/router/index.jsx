import { createBrowserRouter } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import InventarioPage from '../pages/InventarioPage';
import NominaPage from '../pages/NominaPage';
import CrmPage from '../pages/CrmPage';
import ClientesPage from '../pages/ClientesPage';
import FacturacionPage from '../pages/FacturacionPage';
import CobrarPage from '../pages/CobrarPage';
import PagarPage from '../pages/PagarPage';
import ReportesPage from '../pages/ReportesPage';
import ContabilidadPage from '../pages/ContabilidadPage';
import ImpuestosPage from '../pages/ImpuestosPage';
import ProveedoresPage from '../pages/ProveedoresPage';
import ProductosPage from '../pages/ProductosPage';
import ConfiguracionPage from '../pages/ConfiguracionPage';
import NotFoundPage from '../pages/NotFoundPage';
import ImportacionBancariaPage from '../pages/ImportacionBancariaPage';
import RegistroPage from '../pages/RegistroPage';
import RecuperarPasswordPage from '../pages/RecuperarPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import TerminosPage from '../pages/TerminosPage';
import PrivacidadPage from '../pages/PrivacidadPage';
import TrialVencidoPage from '../pages/TrialVencidoPage';
import ProtectedRoute from './ProtectedRoute';

const P = (Page) => <ProtectedRoute><Page /></ProtectedRoute>;

export const router = createBrowserRouter([
  { path: '/',            element: <LandingPage /> },
  { path: '/registro',           element: <RegistroPage /> },
  { path: '/recuperar-password', element: <RecuperarPasswordPage /> },
  { path: '/reset-password',     element: <ResetPasswordPage /> },
  { path: '/terminos',           element: <TerminosPage /> },
  { path: '/privacidad',         element: <PrivacidadPage /> },
  { path: '/login',              element: <LoginPage /> },
  { path: '/dashboard',   element: P(DashboardPage) },
  { path: '/inventario',  element: P(InventarioPage) },
  { path: '/nomina',      element: P(NominaPage) },
  { path: '/crm',         element: P(CrmPage) },
  { path: '/clientes',    element: P(ClientesPage) },
  { path: '/facturacion', element: P(FacturacionPage) },
  { path: '/cobrar',      element: P(CobrarPage) },
  { path: '/pagar',       element: P(PagarPage) },
  { path: '/reportes',      element: P(ReportesPage) },
  { path: '/contabilidad',  element: P(ContabilidadPage) },
  { path: '/impuestos',      element: P(ImpuestosPage) },
  { path: '/proveedores',    element: P(ProveedoresPage) },
  { path: '/productos',      element: P(ProductosPage) },
  { path: '/configuracion',        element: P(ConfiguracionPage) },
  { path: '/importacion-bancaria', element: P(ImportacionBancariaPage) },
  { path: '/trial-vencido',        element: <TrialVencidoPage /> },
  { path: '*',                     element: <NotFoundPage /> },
]);
