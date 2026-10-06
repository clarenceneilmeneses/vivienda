import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Spinner } from "./components/ui";
import { useSettings } from "./lib/queries";
import PublicLayout from "./components/public/PublicLayout";
import Home from "./pages/public/Home";
import Book from "./pages/public/Book";
import MyBooking from "./pages/public/MyBooking";
import Stay from "./pages/public/Stay";

// Signed-in guest pages load when first opened.
const Trips = lazy(() => import("./pages/public/Trips"));
const TripDetail = lazy(() => import("./pages/public/TripDetail"));
const Messages = lazy(() => import("./pages/public/Messages"));
const Profile = lazy(() => import("./pages/public/Profile"));
const ResetPassword = lazy(() => import("./pages/public/ResetPassword"));

// The admin side carries charts and heavier screens; guests never download it.
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const Login = lazy(() => import("./pages/admin/Login"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Bookings = lazy(() => import("./pages/admin/Bookings"));
const Calendar = lazy(() => import("./pages/admin/Calendar"));
const Guests = lazy(() => import("./pages/admin/Guests"));
const Finance = lazy(() => import("./pages/admin/Finance"));
const Units = lazy(() => import("./pages/admin/Units"));
const GeneralSettings = lazy(() => import("./pages/admin/settings/General"));
const BookingRules = lazy(() => import("./pages/admin/settings/BookingRules"));
const PaymentSettings = lazy(() => import("./pages/admin/settings/Payments"));
const NotificationSettings = lazy(() => import("./pages/admin/settings/Notifications"));
const QuickRepliesPage = lazy(() => import("./pages/admin/settings/QuickRepliesPage"));
const AccountSettings = lazy(() => import("./pages/admin/settings/Account"));
const Inbox = lazy(() => import("./pages/admin/Inbox"));
const Reviews = lazy(() => import("./pages/admin/Reviews"));

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
          <Route path="trips" element={<Trips />} />
          <Route path="trips/:ref" element={<TripDetail />} />
          <Route path="messages" element={<Messages />} />
          <Route path="profile" element={<Profile />} />
          <Route path="reset-password" element={<ResetPassword />} />
        </Route>
        <Route path="admin/login" element={<Login />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="guests" element={<Guests />} />
          <Route path="finance" element={<Finance />} />
          <Route path="units" element={<Units />} />
          <Route path="settings" element={<GeneralSettings />} />
          <Route path="settings/booking-rules" element={<BookingRules />} />
          <Route path="settings/payments" element={<PaymentSettings />} />
          <Route path="settings/notifications" element={<NotificationSettings />} />
          <Route path="settings/quick-replies" element={<QuickRepliesPage />} />
          <Route path="settings/account" element={<AccountSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
