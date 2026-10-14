import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PREVIEW_SCREENS, previewEnabled } from "../screens";
import { PreviewScreen } from "./preview-screen";

export function generateStaticParams() {
  return PREVIEW_SCREENS.map((screen) => ({ screen }));
}

async function Screen({ params }: { params: Promise<{ screen: string }> }) {
  const { screen } = await params;
  if (!(PREVIEW_SCREENS as readonly string[]).includes(screen)) notFound();
  return <PreviewScreen screen={screen} />;
}

export default function PreviewPage({ params }: PageProps<"/dev/preview/[screen]">) {
  if (!previewEnabled()) notFound();
  return (
    <Suspense fallback={null}>
      <Screen params={params} />
    </Suspense>
  );
}
