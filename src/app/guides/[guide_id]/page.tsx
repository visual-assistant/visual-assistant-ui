"use client";

import { useParams } from "next/navigation";
import AppShell from "../../../components/AppShell";
import GuideChantierReview from "../../../components/GuideChantierReview";

export default function GuideChantierPage() {
  const params = useParams<{ guide_id: string }>();
  const guideId = params.guide_id;

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50 px-6 py-6">
        <GuideChantierReview guideId={guideId} />
      </main>
    </AppShell>
  );
}
