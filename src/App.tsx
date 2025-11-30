import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import POS from "./pages/POS";
import Admin from "./pages/Admin";
import AdminProducts from "./pages/AdminProducts";
import AdminSales from "./pages/AdminSales";
import AdminReports from "./pages/AdminReports";
import AdminModifiers from "./pages/AdminModifiers";
import AdminCombos from "./pages/AdminCombos";
import AdminProductModifiers from "./pages/AdminProductModifiers";
import AdminPromotions from "./pages/AdminPromotions";
import AdminCustomers from "./pages/AdminCustomers";
import Waiter from "./pages/Waiter";
import WaiterOrder from "./pages/WaiterOrder";
import Kitchen from "./pages/Kitchen";
import KitchenDisplay from "./pages/KitchenDisplay";
import Delivery from "./pages/Delivery";
import NewDelivery from "./pages/NewDelivery";
import CustomerDisplay from "./pages/CustomerDisplay";
import AdminInventory from "./pages/AdminInventory";
import AdminLocations from "./pages/AdminLocations";
import AdminSchedule from "./pages/AdminSchedule";
import TimeTracking from "./pages/TimeTracking";
import AdminReservations from "./pages/AdminReservations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/admin" element={<Admin />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/sales" element={<AdminSales />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/modifiers" element={<AdminModifiers />} />
          <Route path="/admin/combos" element={<AdminCombos />} />
          <Route path="/admin/product-modifiers" element={<AdminProductModifiers />} />
          <Route path="/admin/promotions" element={<AdminPromotions />} />
          <Route path="/admin/customers" element={<AdminCustomers />} />
            <Route path="/waiter" element={<Waiter />} />
            <Route path="/waiter/order/:orderId" element={<WaiterOrder />} />
            <Route path="/kitchen" element={<Kitchen />} />
            <Route path="/kitchen-display" element={<KitchenDisplay />} />
            <Route path="/delivery" element={<Delivery />} />
            <Route path="/delivery/new" element={<NewDelivery />} />
            <Route path="/customer-display" element={<CustomerDisplay />} />
            <Route path="/admin/inventory" element={<AdminInventory />} />
            <Route path="/admin/locations" element={<AdminLocations />} />
            <Route path="/admin/schedule" element={<AdminSchedule />} />
            <Route path="/time-tracking" element={<TimeTracking />} />
            <Route path="/admin/reservations" element={<AdminReservations />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
