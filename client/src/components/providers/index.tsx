import { Suspense, useEffect, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n from "@/lib/i18n";
import { Spinner } from "@/components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
    AnchoredToastProvider,
    installSystemNotificationBridge,
    ToastProvider,
} from "@/components/ui/toast";
import { installVisualViewportCssVars } from "@/lib";
import { MobileOnboarding } from "@/features/mobile-onboarding";
import { SettingsProvider } from "@/features/settings";
import { subscribeToThemeChanges } from "@/features/toggle-theme";
import { PwaLifecycle } from "./PwaLifecycle";


const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    },
});

export function AppProviders({ children }: { children: ReactNode }) {
    useEffect(() => {
        installSystemNotificationBridge();
        return subscribeToThemeChanges();
    }, []);

    // Pin fixed overlays to the Visual Viewport so virtual keyboards do not
    // cover sheet/dialog inputs. Complements interactive-widget=resizes-content
    // in index.html for Chromium.
    useEffect(() => installVisualViewportCssVars(), []);

    return (
        <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={queryClient}>
                <TooltipProvider delay={400}>
                    <ToastProvider>
                        <PwaLifecycle />
                        <MobileOnboarding />
                        <AnchoredToastProvider>
                            <SettingsProvider>
                                <Suspense
                                    fallback={
                                        <div className="flex min-h-dvh items-center justify-center">
                                            <Spinner className="size-6" />
                                        </div>
                                    }
                                >
                                    {children}
                                </Suspense>
                            </SettingsProvider>
                        </AnchoredToastProvider>
                    </ToastProvider>
                </TooltipProvider>
            </QueryClientProvider>
        </I18nextProvider>
    );
}
