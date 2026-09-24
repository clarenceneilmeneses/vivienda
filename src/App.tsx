import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Spinner } from "./components/ui";
import { useSettings } from "./lib/queries";
import PublicLayout from "./components/public/PublicLayout";
import Home from "./pages/public/Home";
import Book from "./pages/public/Book";
import MyBooking from "./pages/public/MyBooking";
import Stay from "./pages/public/Stay";

// The admin side carries charts and heavier screens; guests never download it.
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const Login = lazy(() => import("./pages/admin/Login"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Bookings = lazy(() => import("./pages/admin/Bookings"));
const Calendar = lazy(() => import("./pages/admin/Calendar"));
const Guests = lazy(() => import("./pages/admin/Guests"));
const Finance = lazy(() => import("./pages/admin/Finance"));
const Units = lazy(() => import("./pages/admin/Units"));
const SettingsPage = lazy(() => import("./pages/admin/Settings"));

export default function App() {
  const { data: settings } = useSettings();

  useEffect(() => {
    if (settings?.resort_name) document.title = settings.resort_name;
  }, [settings?.resort_name]);

  return (
    <Suspense fallback={<Spinner className="min-h-screen" />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="stay/:slug" element={<Stay />} />
          <Route path="book" element={<Book />} />
          <Route path="my-booking" element={<MyBooking />} />
        </Route>
        <Route path="admin/login" element={<Login />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="guests" element={<Guests />} />
          <Route path="finance" element={<Finance />} />
          <Route path="units" element={<Units />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
