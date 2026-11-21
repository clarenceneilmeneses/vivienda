import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BookingDetail } from "../../components/admin/BookingDrawer";

/** One booking, on a page of its own. */
export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <>
      <Link to="/admin/bookings" className="link-action mb-4 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft className="size-4" /> All bookings
      </Link>
      {id && <BookingDetail id={id} onClose={() => navigate("/admin/bookings")} />}
    </>
  );
}
