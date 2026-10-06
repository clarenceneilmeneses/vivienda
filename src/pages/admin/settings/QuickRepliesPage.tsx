import { Zap } from "lucide-react";
import { QuickRepliesManager } from "../../../components/admin/QuickReplies";
import { SettingsCard, SettingsHeading } from "../../../components/admin/SettingsKit";

/** Settings → Quick replies: the saved answers under the Inbox's reply box. */
export default function QuickRepliesPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <SettingsHeading
        title="Quick replies"
        description="Saved answers you can drop into any conversation. The first six show as chips above the reply box."
      />
      <SettingsCard
        icon={Zap}
        title="Your replies"
        description={
          <>
            <code className="rounded bg-sand-100 px-1">{"{guest}"}</code> becomes the guest's first name,{" "}
            <code className="rounded bg-sand-100 px-1">{"{resort}"}</code> the resort's name.
          </>
        }
      >
        <QuickRepliesManager />
      </SettingsCard>
    </div>
  );
}
