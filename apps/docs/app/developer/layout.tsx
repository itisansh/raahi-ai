import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { PerspectiveSwitcher } from "@/components/perspective-switcher";
import { developerSource } from "@/lib/source";

export default function DeveloperLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={developerSource.pageTree}
      nav={{
        title: "Raahi AI Docs",
        url: "/",
        children: <PerspectiveSwitcher perspective="developer" />,
      }}
    >
      {children}
    </DocsLayout>
  );
}
