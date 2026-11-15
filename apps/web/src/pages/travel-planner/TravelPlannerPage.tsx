import { ExistingTripPlanning } from "@/widgets/trip-planning";
import { Button } from "@/shared/ui/button";
import { MedicalHelp } from "@/features/medical-help";
import { OfflineItinerary, offlineCopy } from "@/features/offline-itinerary";
import { useNetworkStatus } from "@/shared/lib";
import { IndiaTravelPanel } from "./ui/IndiaTravelPanel";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  fetchTrip,
  renameTrip,
  reversePlace,
  fetchPreferences,
  updatePreferences,
  updateAgentPanelPreference,
  fetchAgentStatus,
  approveAgentSuggestion,
  type AgentSuggestion,
  type UpdateStopInput,
} from "@/shared/api";
import { queryKeys } from "@/shared/config";
import { stopNumbers, upsertTripSummary, type Trip, type TripSummary } from "@/entities/trip";
import type { Stop } from "@/entities/stop";
import { CalendarCheck2, CalendarRange, Map as MapIcon, Wallet } from "lucide-react";
import { useRouter } from "@/app/router";
import { useSession } from "@/shared/auth";
import { cn, useDocumentTitle, useIsMobile } from "@/shared/lib";
import { AppSidebar } from "@/widgets/app-sidebar";
import { Spinner } from "@/shared/ui/spinner";
import { Tabs } from "@/shared/ui/tabs";
import { Splitter, clamp } from "@/shared/ui/splitter";
import { toastManager } from "@/shared/ui/toast";
import { useTripActions } from "./model/useTripActions";
import { useTripRealtime } from "./model/useTripRealtime";
import { useAgentEvents } from "./model/useAgentEvents";
import { BackButton } from "./ui/BackButton";
import { Sidebar, type SidebarProps } from "./ui/Sidebar";
import { MobileAgentSheet } from "./ui/mobile/MobileAgentSheet";
import { MobileItinerarySheet } from "./ui/mobile/MobileItinerarySheet";
import { MobilePlannerHeader } from "./ui/mobile/MobilePlannerHeader";
import { MobileStopDetailSheet } from "./ui/mobile/MobileStopDetailSheet";
import { MobileTabBar } from "./ui/mobile/MobileTabBar";
import { AgentToggle } from "./ui/agent/AgentToggle";
import { AgentDrawer } from "./ui/agent/AgentDrawer";
import { AgentInterventionToasts } from "./ui/agent/AgentInterventionToast";
import { NoteEditorPane } from "./ui/NoteEditorPane";
import { TripMapView } from "./ui/TripMapView";
import { ScheduleBoard, type ComposeDraft } from "./ui/ScheduleBoard";
import { BudgetBoard } from "./ui/BudgetBoard";
import { FloatingMembers } from "./ui/FloatingMembers";
import { ReservationsBoard } from "./ui/ReservationsBoard";
import { StreetViewViewerProvider } from "./ui/street-view/StreetViewViewerProvider";

type Tab = "map" | "schedule" | "reservations" | "budget";

const MIN_SIDEBAR_WIDTH = 0;
const MAX_SIDEBAR_WIDTH = 55;
const DEFAULT_SIDEBAR_WIDTH = 44;
const SIDEBAR_STEP = 1;

export function TravelPlannerPage({ tripId }: { tripId: string }) {
  const online = useNetworkStatus();
  const { t } = useTranslation("planner");
  const { t: tc } = useTranslation("common");
  const { t: ta } = useTranslation("agent");
  const { navigate } = useRouter();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "lynn";
  const preferredCurrency = session?.user?.defaultCurrency;

  const { i18n } = useTranslation();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<Tab>("map");
  const [day, setDay] = useState(0);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [noteEditingStopId, setNoteEditingStopId] = useState<string | null>(
    null,
  );
  const [compose, setCompose] = useState<ComposeDraft | null>(null);
  const [picking, setPicking] = useState(false);
  const [locateSignal, setLocateSignal] = useState(0);

  const queryClient = useQueryClient();
  const { data: trip, isPending, isError, error: tripError, refetch } = useQuery({
    queryKey: queryKeys.trip(tripId),
    queryFn: () => fetchTrip(tripId),
  });
  const actions = useTripActions(tripId);
  const realtime = useTripRealtime(tripId, Boolean(trip));

  useDocumentTitle(trip?.title);

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const previousSidebarWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const sidebarCollapsed = sidebarWidth <= MIN_SIDEBAR_WIDTH;

  const { data: preferences } = useQuery({
    queryKey: queryKeys.preferences,
    queryFn: fetchPreferences,
    staleTime: 5 * 60 * 1000,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: updatePreferences,
    onSuccess: async (data) => {
      queryClient.setQueryData(queryKeys.preferences, data);
    },
  });

  useEffect(() => {
    if (!preferences) return;
    const preferredWidth = preferences.plannerSidebar?.width;
    const width = clamp(
      preferredWidth === 30 ? DEFAULT_SIDEBAR_WIDTH : preferredWidth ?? DEFAULT_SIDEBAR_WIDTH,
      MIN_SIDEBAR_WIDTH,
      MAX_SIDEBAR_WIDTH,
    );
    setSidebarWidth(width);
    if (width > MIN_SIDEBAR_WIDTH) {
      previousSidebarWidthRef.current = width;
    }
  }, [preferences]);

  useEffect(() => {
    if (sidebarWidth > MIN_SIDEBAR_WIDTH) {
      previousSidebarWidthRef.current = sidebarWidth;
    }
  }, [sidebarWidth]);

  const handleSidebarChange = useCallback((value: number) => {
    setSidebarWidth(value);
  }, []);

  const persistSidebar = useCallback(
    (value: number) => {
      updatePreferencesMutation.mutate({
        plannerSidebarWidth: value,
        plannerSidebarCollapsed: value <= MIN_SIDEBAR_WIDTH,
      });
    },
    [updatePreferencesMutation],
  );

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarWidth((current) => {
      let next: number;
      if (current <= MIN_SIDEBAR_WIDTH) {
        next = Math.min(
          Math.max(previousSidebarWidthRef.current, MIN_SIDEBAR_WIDTH + SIDEBAR_STEP),
          MAX_SIDEBAR_WIDTH,
        );
      } else {
        previousSidebarWidthRef.current = current;
        next = MIN_SIDEBAR_WIDTH;
      }
      persistSidebar(next);
      return next;
    });
  }, [persistSidebar]);

  // ----- Trip agent (only active when the deployment has AI configured) -----
  const { data: agentStatus } = useQuery({
    queryKey: queryKeys.agentStatus,
    queryFn: fetchAgentStatus,
    staleTime: Infinity,
  });
  const agentEnabled = agentStatus?.enabled ?? false;

  // Prefer React Query cache as the single source of truth. A separate
  // useState + useEffect(preferences) race: open → optimistic false → late
  // GET /preferences with stale true re-collapses the panel immediately.
  const agentCollapsed = preferences?.agentPanelCollapsed ?? true;
  const agentPanelMutation = useMutation({
    mutationFn: updateAgentPanelPreference,
    onMutate: async (collapsed) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.preferences });
      const previous = queryClient.getQueryData<
        Awaited<ReturnType<typeof fetchPreferences>>
      >(queryKeys.preferences);
      if (previous) {
        queryClient.setQueryData(queryKeys.preferences, {
          ...previous,
          agentPanelCollapsed: collapsed,
        });
      }
      return { previous };
    },
    onError: (_err, _collapsed, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.preferences, context.previous);
      }
    },
    onSuccess: (data) => queryClient.setQueryData(queryKeys.preferences, data),
  });
  const setAgentPanel = useCallback(
    (collapsed: boolean) => {
      agentPanelMutation.mutate(collapsed);
    },
    [agentPanelMutation],
  );

  // Open the agent panel once when a create-wizard prompt draft is waiting.
  const openedSeedTrip = useRef<string | null>(null);
  useEffect(() => {
    if (!agentEnabled || !trip?.agentSeedPending) return;
    if (openedSeedTrip.current === trip.id) return;
    openedSeedTrip.current = trip.id;
    if (!agentCollapsed) return;
    setAgentPanel(false);
  }, [agentEnabled, trip?.agentSeedPending, trip?.id, agentCollapsed, setAgentPanel]);

  // Only poll when the trip is readable; non-members get 404 and should not
  // hammer /agent/events (same existence-hiding 404 as getTrip).
  const { suggestions: agentSuggestions, newMessages } = useAgentEvents(
    tripId,
    agentEnabled && Boolean(trip),
  );
  const pendingSuggestions = useMemo(
    () => agentSuggestions.filter((s) => s.status === "pending"),
    [agentSuggestions],
  );

  // Retire toasts and refresh the trip when someone else applies a suggestion.
  const seenPendingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const s of agentSuggestions) {
      if (s.status === "pending") {
        seenPendingRef.current.add(s.id);
      } else if (seenPendingRef.current.delete(s.id) && s.status === "applied") {
        if (s.appliedBy && s.appliedBy !== currentUserId) {
          const name =
            trip?.members.find((m) => m.userId === s.appliedBy)?.name ?? "";
          toastManager.add({
            title: name
              ? ta("toast.appliedByOther", { name })
              : ta("toast.applied"),
            type: "info",
          });
          // Do not invalidate trip here — Hyperdrive may return a stale trip
          // and erase concurrent local edits. Collaborators pick up the change
          // on the next write-echo or full navigation.
        }
      }
    }
  }, [agentSuggestions, currentUserId, trip, ta]);

  const seenMentionToastRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!agentEnabled) return;
    for (const message of newMessages) {
      if (message.actorUserId === currentUserId) continue;
      if (!(message.mentionedUserIds ?? []).includes(currentUserId)) continue;
      if (seenMentionToastRef.current.has(message.id)) continue;
      seenMentionToastRef.current.add(message.id);

      const preview = message.parts
        .filter((p) => p.type === "text" && typeof p.text === "string")
        .map((p) => p.text as string)
        .join("\n")
        .trim()
        .slice(0, 140);

      toastManager.add({
        title: ta("mention.toastTitle", {
          name: message.actorName ?? ta("panel.systemName"),
        }),
        description: preview || undefined,
        type: "info",
        actionProps: {
          onClick: () => setAgentPanel(false),
          children: ta("mention.view"),
        },
      });
    }
  }, [newMessages, currentUserId, agentEnabled, ta, setAgentPanel]);

  /** Proactive suggestions use the same approval DTO as AI SDK tools. */
  const approveSuggestionMutation = useMutation({
    mutationFn: (input: { id: string; approved: boolean }) =>
      approveAgentSuggestion(tripId, input),
    onSuccess: (result, variables) => {
      if (variables.approved && result && "id" in result) {
        void queryClient.cancelQueries({ queryKey: queryKeys.trip(tripId) });
        queryClient.setQueryData(queryKeys.trip(tripId), result);
        toastManager.add({ title: ta("toast.applied"), type: "success" });
      }
    },
    onError: (err) => {
      const stale =
        err instanceof ApiError &&
        (err.status === 409 || err.code === "suggestion_stale");
      toastManager.add({
        title: stale ? ta("toast.stale") : ta("toast.applyError"),
        type: "error",
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentEvents(tripId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.agentMessages(tripId) });
    },
  });

  const handleApproveSuggestion = useCallback(
    (s: AgentSuggestion) =>
      approveSuggestionMutation.mutate({ id: s.id, approved: true }),
    [approveSuggestionMutation],
  );
  const handleDenySuggestion = useCallback(
    (s: AgentSuggestion) =>
      approveSuggestionMutation.mutate({ id: s.id, approved: false }),
    [approveSuggestionMutation],
  );
  const handleDiscussSuggestion = useCallback(
    () => setAgentPanel(false),
    [setAgentPanel],
  );
  const applyingSuggestionId =
    approveSuggestionMutation.isPending &&
    approveSuggestionMutation.variables?.approved
      ? approveSuggestionMutation.variables.id
      : null;

  const rename = useMutation({
    mutationFn: (title: string) => renameTrip(tripId, title),
    onSuccess: (trip) => {
      void queryClient.cancelQueries({ queryKey: queryKeys.trip(tripId) });
      queryClient.setQueryData(queryKeys.trip(tripId), trip);
      queryClient.setQueryData(
        queryKeys.trips,
        (old: TripSummary[] | undefined) => upsertTripSummary(old, trip),
      );
    },
  });

  const numbers = useMemo(
    () => (trip ? stopNumbers(trip.stops) : new Map<string, number>()),
    [trip],
  );

  // Bias place search toward the trip's existing footprint for local relevance.
  const bias = useMemo(() => {
    const first = trip?.stops?.[0];
    return first ? { lat: first.lat, lng: first.lng } : undefined;
  }, [trip]);

  const openCompose = (d: number, index: number) =>
    setCompose({
      day: d,
      index,
      name: "",
      time: "",
      costCurrency: preferredCurrency || trip?.currency,
    });
  const patchCompose = (patch: Partial<ComposeDraft>) =>
    setCompose((c) => (c ? { ...c, ...patch } : c));
  const cancelCompose = () => {
    setCompose(null);
    setPicking(false);
  };
  const confirmCompose = () => {
    setCompose((c) => {
      const name = c?.name.trim();
      if (c && name) {
        actions.stop.mutate({
          day: c.day,
          index: c.index,
          name,
          time: c.time.trim(),
          duration: c.duration?.trim() || undefined,
          lat: c.lat,
          lng: c.lng,
          area: c.area,
          category: c.category,
          cost: c.cost,
          costCurrency: c.costCurrency,
          note: c.note?.trim() || undefined,
        });
      }
      return null;
    });
    setPicking(false);
  };
  const startPickOnMap = () => {
    if (!compose) return;
    setPicking(true);
    setTab("map");
  };
  const handleMapPick = async (lng: number, lat: number) => {
    setPicking(false);
    setTab("schedule");
    let name: string | undefined;
    let area: string | undefined;
    try {
      const place = await reversePlace(lat, lng, i18n.resolvedLanguage ?? "en");
      if (place) {
        name = place.label;
        area = place.secondary || undefined;
      }
    } catch {
      // Reverse geocoding is best-effort; keep any name the user already typed.
    }
    setCompose((c) =>
      c ? { ...c, lat, lng, name: c.name.trim() || name || c.name, area } : c,
    );
  };
  // Right-click "Add a stop here": open the composer pre-filled at the clicked point.
  const addStopAt = async (lng: number, lat: number) => {
    if (!trip) return;
    const targetDay = day > 0 ? day : (trip.days[0]?.number ?? 1);
    const index = trip.stops.filter((s) => s.day === targetDay).length;
    setCompose({
      day: targetDay,
      index,
      name: "",
      time: "",
      lat,
      lng,
      costCurrency: preferredCurrency || trip.currency,
    });
    setPicking(false);
    setTab("schedule");
    try {
      const place = await reversePlace(lat, lng, i18n.resolvedLanguage ?? "en");
      if (place) {
        setCompose((c) =>
          c
            ? {
                ...c,
                name: c.name.trim() || place.label,
                area: place.secondary || undefined,
              }
            : c,
        );
      }
    } catch {
      // Reverse geocoding is best-effort; the user can still type a name.
    }
  };

  // Must stay above pending/error early returns — otherwise trip load adds a
  // hook and React throws #310 ("Rendered more hooks than during the previous render").
  useEffect(() => {
    if (!trip || !noteEditingStopId) return;
    if (!trip.stops.some((s) => s.id === noteEditingStopId)) {
      setNoteEditingStopId(null);
    }
  }, [noteEditingStopId, trip]);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Spinner className="size-6" />
      </div>
    );
  }

  const accessDenied = tripError instanceof ApiError && [401, 403, 404].includes(tripError.status);
  if (!trip || accessDenied || (isError && online && !(tripError instanceof TypeError))) {
    // Non-members get the same 404 as missing trips (no existence leak).
    // Direct /trips/:id links without joining via /invite/:token hit this.
    return (
      <div className="flex h-dvh bg-sidebar">
        <AppSidebar
          className="max-md:hidden"
          top={<BackButton onBack={() => navigate("/")} />}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-l-2xl border border-r-0 border-border bg-background px-6 text-center max-md:rounded-none max-md:border-0">
          <p className="text-sm font-medium text-pretty text-foreground">
            {tc("state.tripUnavailable")}
          </p>
          <p className="max-w-sm text-sm text-pretty text-muted-foreground">
            {tc("state.tripUnavailableHint")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex h-10 items-center justify-center px-2 text-sm text-corn-600 transition-[color,scale] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:underline active:scale-[var(--press-scale)]"
            >
              {tc("actions.back")}
            </button>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex h-10 items-center justify-center px-2 text-sm text-muted-foreground transition-[color,scale] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:underline active:scale-[var(--press-scale)]"
            >
              {tc("state.retry")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabItems = [
    { value: "map", label: t("tabs.map"), icon: MapIcon },
    { value: "schedule", label: t("tabs.schedule"), icon: CalendarRange },
    { value: "reservations", label: t("tabs.reservations"), icon: CalendarCheck2 },
    { value: "budget", label: t("tabs.budget"), icon: Wallet },
  ];

  const selectStop = (id: string) => {
    setSelectedStopId(id);
    setNoteEditingStopId((current) => (current && current !== id ? null : current));
  };

  const focusGeneratedDay = (dayNumber: number) => {
    if (!trip.days.some((candidate) => candidate.number === dayNumber)) {
      toastManager.add({ title: ta("generated.staleDay"), type: "error" });
      return;
    }
    setDay(dayNumber);
    setSelectedStopId(null);
    setNoteEditingStopId(null);
    setTab("schedule");
    setAgentPanel(true);
  };

  const focusGeneratedStop = (stopId: string) => {
    const stop = trip.stops.find((candidate) => candidate.id === stopId);
    if (!stop) {
      toastManager.add({ title: ta("generated.staleStop"), type: "error" });
      return;
    }
    setDay(stop.day);
    setNoteEditingStopId(null);
    setTab("map");
    selectStop(stop.id);
    setAgentPanel(true);
  };

  const noteEditingStop = noteEditingStopId
    ? trip.stops.find((s) => s.id === noteEditingStopId)
    : undefined;

  const openNoteEditor = (stopId: string) => {
    setSelectedStopId(stopId);
    setNoteEditingStopId(stopId);
  };

  const closeNoteEditor = () => {
    setNoteEditingStopId(null);
  };

  const writeStopTravelogue = (stop: Stop) => {
    const search = new URLSearchParams({
      compose: "stop",
      tripId: trip.id,
      title: stop.name,
    });
    navigate(`/journal?${search.toString()}`);
  };

  const headerSubtitle = formatTripSubtitle(trip, i18n.language, t);
  const agentPanelOpen = agentEnabled && !agentCollapsed;

  const sidebarProps: SidebarProps = {
    trip,
    day,
    onDayChange: (d) => {
      setDay(d);
      setSelectedStopId(null);
      setNoteEditingStopId(null);
    },
    selectedStopId,
    onSelectStop: selectStop,
    onCloseDetail: () => setSelectedStopId(null),
    currentUserId,
    canEdit: trip.permissions.canEdit && online,
    onToggleVote: (stopId) => actions.vote.mutate(stopId),
    onComment: (stopId, text) => actions.comment.mutate({ stopId, text }),
    commentPending: actions.comment.isPending,
    onUpdateStop: (stopId, patch: UpdateStopInput) =>
      actions.stopUpdate.mutate({ stopId, patch }),
    onChangeStopDay: (stopId, targetDay) => {
      const index = trip.stops.filter((s) => s.day === targetDay).length;
      actions.stopMove.mutate({ stopId, day: targetDay, index });
    },
    onExpandNote: openNoteEditor,
    onWriteTravelogue: (stopId) => {
      const stop = trip.stops.find((candidate) => candidate.id === stopId);
      if (stop) writeStopTravelogue(stop);
    },
  };

  const selectedStop = selectedStopId
    ? trip.stops.find((s) => s.id === selectedStopId)
    : undefined;

  const floatingMembers = noteEditingStop ? null : (
    <FloatingMembers
      tripId={trip.id}
      members={trip.members}
      canInvite={trip.permissions.canInvite}
      onlineUserIds={realtime.presence.map((member) => member.userId)}
      onLocateMe={() => {
        if (tab !== "map") setTab("map");
        setLocateSignal((n) => n + 1);
      }}
    />
  );

  // All four mode panes stay mounted so switching modes preserves each pane's
  // scroll position and keeps the MapLibre canvas alive; only the active pane
  // is visible. The note editor overlays them all while open.
  const panes = (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative z-20 m-3 flex w-fit max-w-[calc(100%-1.5rem)] flex-none flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-md">
        {!isMobile && <Tabs items={tabItems} value={tab} alwaysShowLabels onValueChange={value => { setNoteEditingStopId(null); setTab(value as Tab); }} aria-label={t("navigation")} />}
        <MedicalHelp tripId={trip.id} stops={trip.stops} selectedStopId={selectedStopId} />
        {floatingMembers}
        {!isMobile && agentEnabled && agentCollapsed && <AgentToggle onOpen={() => setAgentPanel(false)} />}
      </div>
      <div className="relative min-h-0 flex-1">
      {(!online || tripError instanceof TypeError) && <div role="status" className="absolute bottom-3 left-3 right-3 z-20 rounded-lg border border-border bg-background p-3 text-sm">{offlineCopy.offline}<Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>{offlineCopy.retry}</Button></div>}
      <PlannerPane active={!noteEditingStop && tab === "map"}>
        <TripMapView
          trip={trip}
          numbers={numbers}
          day={day}
          activeStopId={selectedStopId}
          onSelectStop={(id) => {
            selectStop(id);
            if (sidebarCollapsed) { setSidebarWidth(DEFAULT_SIDEBAR_WIDTH); persistSidebar(DEFAULT_SIDEBAR_WIDTH); }
          }}
          picking={picking}
          onPick={handleMapPick}
          onAddStopHere={addStopAt}
          locateSignal={locateSignal}
          onCancelPick={() => {
            setPicking(false);
            setTab("schedule");
          }}
        />
      </PlannerPane>
      <PlannerPane active={!noteEditingStop && tab === "schedule"}>
        <ScheduleBoard
          trip={trip}
          compose={compose}
          defaultCurrency={preferredCurrency || trip.currency}
          biasLat={bias?.lat}
          biasLng={bias?.lng}
          onOpen={openCompose}
          onChange={patchCompose}
          onConfirm={confirmCompose}
          onCancel={cancelCompose}
          onPickOnMap={startPickOnMap}
          onSelectStop={(id) => {
            setTab("map");
            setDay(0);
            selectStop(id);
          }}
          onAddDay={() => actions.day.mutate()}
          onUpdateDay={(dayNumber, patch) =>
            actions.dayUpdate.mutate({ dayNumber, patch })
          }
          onDeleteDay={(dayNumber) => actions.dayDelete.mutate(dayNumber)}
          onReorderDays={(order) => actions.dayReorder.mutate(order)}
          onMoveStop={(input) => actions.stopMove.mutate(input)}
          addingDay={actions.day.isPending}
          deletingDayNumber={
            actions.dayDelete.isPending
              ? actions.dayDelete.variables
              : undefined
          }
          updatingDayNumber={
            actions.dayUpdate.isPending
              ? actions.dayUpdate.variables?.dayNumber
              : undefined
          }
        />
      </PlannerPane>
      <PlannerPane active={!noteEditingStop && tab === "reservations"} scroll>
        <OfflineItinerary trip={trip} />
        <IndiaTravelPanel trip={trip} />
        <ReservationsBoard trip={trip} canEdit={trip.permissions.canEdit && online} />
      </PlannerPane>
      <PlannerPane active={!noteEditingStop && tab === "budget"} scroll>
        <BudgetBoard
          trip={trip}
          currentUserId={currentUserId}
          defaultCurrency={preferredCurrency || trip.currency}
          canEdit={trip.permissions.canEdit && online}
          onAddExpense={(input) => actions.expense.mutateAsync(input)}
          onUpdateExpense={(expenseId, input) =>
            actions.expenseUpdate.mutateAsync({ expenseId, input })
          }
        />
      </PlannerPane>
      {noteEditingStop ? (
        <div className="absolute inset-0 z-10 overflow-hidden bg-background">
          <NoteEditorPane
            tripId={trip.id}
            editorKey={noteEditingStop.id}
            value={noteEditingStop.note}
            placeholder={t("detail.notePlaceholder")}
            onCommit={(note) =>
              actions.stopUpdate.mutate({
                stopId: noteEditingStop.id,
                patch: { note },
              })
            }
            onClose={closeNoteEditor}
          />
        </div>
      ) : null}
      </div>
    </div>
  );


  if (isMobile) {
    return (
      <StreetViewViewerProvider tripId={trip.id}>
        <div className="flex h-dvh flex-col bg-background">
        <MobilePlannerHeader
          title={trip.title}
          subtitle={headerSubtitle}
          onBack={() => navigate("/")}
          onRename={(title) => rename.mutate(title)}
          onOpenAgent={agentEnabled ? () => setAgentPanel(false) : undefined}
        />
        {trip.permissions.canEdit && online && <div className="flex justify-end border-b px-3 py-2"><ExistingTripPlanning tripId={trip.id} /></div>}
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {panes}
          {!noteEditingStop && tab === "map" ? (
            <MobileItinerarySheet {...sidebarProps} />
          ) : null}
        </main>
        <MobileTabBar
          items={tabItems}
          value={tab}
          onValueChange={(v) => {
            setNoteEditingStopId(null);
            setTab(v as Tab);
          }}
        />
        <MobileStopDetailSheet
          trip={trip}
          stop={!noteEditingStop && tab === "map" ? selectedStop : undefined}
          currentUserId={currentUserId}
          canEdit={trip.permissions.canEdit && online}
          onClose={() => setSelectedStopId(null)}
          onToggleVote={sidebarProps.onToggleVote}
          onComment={sidebarProps.onComment}
          commentPending={actions.comment.isPending}
          onUpdateStop={sidebarProps.onUpdateStop}
          onChangeStopDay={sidebarProps.onChangeStopDay}
          onExpandNote={openNoteEditor}
          onWriteTravelogue={(stopId) => {
            const stop = trip.stops.find((candidate) => candidate.id === stopId);
            if (stop) writeStopTravelogue(stop);
          }}
        />
        {agentEnabled ? (
          <MobileAgentSheet
            open={!agentCollapsed}
            tripId={trip.id}
            trip={trip}
            canEdit={trip.permissions.canEdit && online}
            applyingId={applyingSuggestionId}
            onApproveSuggestion={handleApproveSuggestion}
            onDenySuggestion={handleDenySuggestion}
            onFocusDay={focusGeneratedDay}
            onFocusStop={focusGeneratedStop}
            onClose={() => setAgentPanel(true)}
          />
        ) : null}
        {agentEnabled ? (
          <AgentInterventionToasts
            suggestions={pendingSuggestions}
            canEdit={trip.permissions.canEdit && online}
            applyingId={applyingSuggestionId}
            onApprove={handleApproveSuggestion}
            onDiscuss={handleDiscussSuggestion}
            onDeny={handleDenySuggestion}
          />
        ) : null}
        </div>
      </StreetViewViewerProvider>
    );
  }

  return (
    <StreetViewViewerProvider tripId={trip.id}>
      <div className="flex h-dvh bg-sidebar">
      <Splitter
        orientation="horizontal"
        value={sidebarWidth}
        min={MIN_SIDEBAR_WIDTH}
        max={MAX_SIDEBAR_WIDTH}
        step={SIDEBAR_STEP}
        primaryPaneId="planner-sidebar"
        aria-label={t("splitter.sidebarLabel")}
        onChange={handleSidebarChange}
        onChangeEnd={persistSidebar}
      >
        <AppSidebar
          collapsed={sidebarCollapsed}
          onCollapsedChange={toggleSidebarCollapsed}
          top={
            <div className="flex min-w-0 items-start gap-2">
              <div className="min-w-0 flex-1">
                <BackButton
                  onBack={() => navigate("/")}
                  title={trip.title}
                  subtitle={headerSubtitle}
                  onRename={(title) => rename.mutate(title)}
                />
              </div>
              {trip.permissions.canEdit && online && <ExistingTripPlanning tripId={trip.id} />}

            </div>
          }
        >
          <Sidebar {...sidebarProps} />
        </AppSidebar>

        <div className="flex min-h-0 min-w-0 flex-1">
        <div
          className={cn(
            "relative z-[5] flex min-w-0 flex-1 overflow-hidden border border-border bg-background transition-[border-radius,box-shadow] duration-[var(--dur-slow)] ease-[var(--ease-out)]",
            agentPanelOpen
              ? "rounded-2xl shadow-[-8px_0_24px_-16px_rgba(15,23,42,0.25),8px_0_24px_-16px_rgba(15,23,42,0.25)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.025)]"
              : "rounded-l-2xl border-r-0 shadow-[-8px_0_24px_-16px_rgba(15,23,42,0.25)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.025)]",
          )}
        >
          <main className="relative flex min-w-0 flex-1 flex-col">
            {panes}
            </main>
      </div>

          {agentEnabled ? (
            <AgentDrawer
              open={!agentCollapsed}
              tripId={trip.id}
              trip={trip}
              canEdit={trip.permissions.canEdit && online}
              applyingId={applyingSuggestionId}
              onApproveSuggestion={handleApproveSuggestion}
              onDenySuggestion={handleDenySuggestion}
              onFocusDay={focusGeneratedDay}
              onFocusStop={focusGeneratedStop}
              onClose={() => setAgentPanel(true)}
            />
          ) : null}
        </div>
      </Splitter>



      {agentEnabled ? (
        <AgentInterventionToasts
          suggestions={pendingSuggestions}
          canEdit={trip.permissions.canEdit && online}
          applyingId={applyingSuggestionId}
          onApprove={handleApproveSuggestion}
          onDiscuss={handleDiscussSuggestion}
          onDeny={handleDenySuggestion}
        />
      ) : null}
      </div>
    </StreetViewViewerProvider>
  );
}

/** Absolutely stacked mode pane; inactive panes keep layout (and scroll
 * position) but are hidden from view, pointer events, and the a11y tree. */
function PlannerPane({
  active,
  scroll = false,
  children,
}: {
  active: boolean;
  /** Boards without their own scroll container scroll within the pane. */
  scroll?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden={!active}
      className={cn(
        "absolute inset-0",
        scroll && "overflow-auto",
        !active && "invisible",
      )}
    >
      {children}
    </div>
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function formatTripSubtitle(
  trip: Trip,
  locale: string,
  t: TFunction<"planner">,
): string {
  const dayCount = trip.days.length;
  const stopCount = trip.stops.length;

  let startLabel = "";
  let endLabel = "";

  if (ISO_DATE.test(trip.startDate) && dayCount > 0) {
    const [y, m, d] = trip.startDate.split("-").map(Number) as [
      number,
      number,
      number,
    ];
    const start = new Date(Date.UTC(y, m - 1, d));
    const end = new Date(Date.UTC(y, m - 1, d + dayCount - 1));
    const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
    const fmt = (date: Date, withYear: boolean) =>
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        year: withYear ? "numeric" : undefined,
        timeZone: "UTC",
      }).format(date);
    startLabel = fmt(start, !sameYear);
    endLabel = fmt(end, true);
  }

  return t("header.subtitle", {
    start: startLabel,
    end: endLabel,
    days: dayCount,
    stops: stopCount,
  });
}
