import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as DayPicker } from "@/components/ui/calendar";
import { Layout } from "@/components/layout/Layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  differenceInMinutes,
  format,
  formatDistanceToNow,
  isSameDay,
  isWithinInterval,
  startOfDay,
  startOfWeek,
  subMinutes,
} from "date-fns";
import { fr } from "date-fns/locale";
import { fetchScheduledAppointments, type ScheduledAppointmentRecord } from "@/features/calendar/api";
import { useOrg } from "@/features/organizations/OrgContext";

type EventStatus = "confirmed" | "pending" | "reschedule";
type EventSource = "crm" | "google";

type CalendarEvent = {
  id: string;
  title: string;
  type: string;
  typeColor: string;
  start: Date;
  end: Date;
  location: string;
  assignedTo: string;
  status: EventStatus;
  source: EventSource;
  notes?: string;
  entityType: ScheduledAppointmentRecord["entityType"];
  leadId: string | null;
  projectId: string | null;
  detailUrl?: string;
  detailLabel?: string;
};
const DEFAULT_APPOINTMENT_TYPE_COLOR = "bg-slate-500/10 text-slate-600 border-slate-200";

const APPOINTMENT_TYPE_COLORS: Record<string, string> = {
  "Visite technique": "bg-blue-500/10 text-blue-600 border-blue-200",
  Installation: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  Relance: "bg-amber-500/10 text-amber-600 border-amber-200",
  "Présentation devis": "bg-purple-500/10 text-purple-600 border-purple-200",
  Interne: DEFAULT_APPOINTMENT_TYPE_COLOR,
  "Suivi projet": "bg-cyan-500/10 text-cyan-600 border-cyan-200",
  "Pré-visite": "bg-indigo-500/10 text-indigo-600 border-indigo-200",
  "Signature devis": "bg-pink-500/10 text-pink-600 border-pink-200",
  "Signature AH": "bg-rose-500/10 text-rose-600 border-rose-200",
  Travaux: "bg-orange-500/10 text-orange-600 border-orange-200",
};

const DEFAULT_EVENT_DURATION_MINUTES = 60;

const parseDateTime = (dateStr: string | null, timeStr: string | null): Date | null => {
  if (!dateStr) return null;

  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number.parseInt(yearStr ?? "", 10);
  const month = Number.parseInt(monthStr ?? "", 10) - 1;
  const day = Number.parseInt(dayStr ?? "", 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  let hours = 0;
  let minutes = 0;

  if (timeStr) {
    const [hoursStr, minutesStr] = timeStr.split(":");
    const parsedHours = Number.parseInt(hoursStr ?? "", 10);
    const parsedMinutes = Number.parseInt(minutesStr ?? "", 10);

    if (Number.isFinite(parsedHours)) {
      hours = parsedHours;
    }

    if (Number.isFinite(parsedMinutes)) {
      minutes = parsedMinutes;
    }
  }

  const result = new Date(year, month, day, hours, minutes, 0, 0);

  return Number.isNaN(result.getTime()) ? null : result;
};

const getAppointmentTypeColor = (label: string | null | undefined) => {
  if (!label) return DEFAULT_APPOINTMENT_TYPE_COLOR;
  return APPOINTMENT_TYPE_COLORS[label] ?? DEFAULT_APPOINTMENT_TYPE_COLOR;
};

const determineEventStatus = (leadStatus: string | null | undefined): EventStatus => {
  if (!leadStatus) return "confirmed";

  const normalized = leadStatus.toLowerCase();

  if (normalized.includes("replan") || normalized.includes("report") || normalized.includes("annul")) {
    return "reschedule";
  }

  if (
    normalized.includes("program") ||
    normalized.includes("planifier") ||
    normalized.includes("rappel") ||
    normalized.includes("attente") ||
    normalized.includes("relance") ||
    normalized.includes("contact")
  ) {
    return "pending";
  }

  return "confirmed";
};

const mapAppointmentsToEvents = (
  records: ScheduledAppointmentRecord[],
): CalendarEvent[] =>
  records
    .map((record) => {
      const start = parseDateTime(record.date, record.time);
      if (!start) return null;

      const durationMinutes = record.durationMinutes && record.durationMinutes > 0
        ? record.durationMinutes
        : DEFAULT_EVENT_DURATION_MINUTES;
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      const typeLabel = record.appointmentType?.name ?? "Rendez-vous";
      const typeColor = getAppointmentTypeColor(typeLabel);

      const titleSegments = [typeLabel, record.fullName].filter(Boolean);
      const title = titleSegments.length > 0 ? titleSegments.join(" – ") : record.fullName ?? "Rendez-vous";

      const location =
        record.location ??
        ([record.address, record.postalCode, record.city]
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value))
          .join(" ") ||
        "Adresse à confirmer");

      const assignedTo = record.assignedTo ?? record.project?.assignedTo ?? "Non attribué";

      const notesParts: string[] = [];
      if (record.productName) notesParts.push(`Produit: ${record.productName}`);
      if (record.project?.projectRef) notesParts.push(`Projet ${record.project.projectRef}`);
      if (record.commentaire) notesParts.push(record.commentaire);
      const notes = notesParts.length > 0 ? notesParts.join(" · ") : undefined;

      const projectId = record.project?.id ?? record.projectId ?? null;
      const leadId = record.leadId ?? (record.entityType === "lead" ? record.id : null);

      let detailUrl: string | undefined;
      let detailLabel: string | undefined;

      if (projectId) {
        detailUrl = `/projects/${projectId}`;
        if (record.project?.projectRef) {
          detailLabel = `Voir le projet ${record.project.projectRef}`;
        } else if (record.project?.clientName) {
          detailLabel = `Voir le projet de ${record.project.clientName}`;
        } else {
          detailLabel = "Voir le projet";
        }
      } else if (record.entityType === "lead" && leadId) {
        detailUrl = `/leads/${leadId}`;
        detailLabel = "Voir le lead";
      }

      return {
        id: record.id,
        title,
        type: typeLabel,
        typeColor,
        start,
        end,
        location,
        assignedTo,
        status: determineEventStatus(record.status),
        source: record.source,
        notes,
        entityType: record.entityType,
        leadId,
        projectId,
        detailUrl,
        detailLabel,
      } satisfies CalendarEvent;
    })
    .filter((event) => event !== null) as CalendarEvent[];

const sourceLabels: Record<EventSource, { label: string; className: string }> = {
  crm: { label: "CRM", className: "bg-primary/10 text-primary border-primary/20" },
  google: { label: "Google", className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" },
};

const statusConfig: Record<
  EventStatus,
  { label: string; className: string; icon: LucideIcon }
> = {
  confirmed: {
    label: "Confirmé",
    className: "text-emerald-600",
    icon: CheckCircle2,
  },
  pending: {
    label: "En attente",
    className: "text-amber-600",
    icon: Clock,
  },
  reschedule: {
    label: "À replanifier",
    className: "text-rose-600",
    icon: AlertTriangle,
  },
};

const googleIntegration = {
  connected: true,
  calendarName: "Planning Équipe Commerciale",
  lastSync: subMinutes(new Date(), 42),
  primaryEmail: "planning@ecoprorenov.fr",
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const CalendarPage = () => {
  const { currentOrgId } = useOrg();

  const {
    data: appointments = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ScheduledAppointmentRecord[], Error>({
    queryKey: ["calendar-events", currentOrgId],
    enabled: Boolean(currentOrgId),
    queryFn: async () => {
      if (!currentOrgId) return [];
      return fetchScheduledAppointments(currentOrgId);
    },
    staleTime: 60 * 1000,
  });

  const events = useMemo(
    () => mapAppointmentsToEvents(appointments),
    [appointments],
  );

  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [activeDay, setActiveDay] = useState<Date>(new Date());
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  useEffect(() => {
    const today = new Date();
    setActiveDay(today);
    setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
    setHasInitializedSelection(false);
  }, [currentOrgId]);

  useEffect(() => {
    if (!hasInitializedSelection && events.length > 0) {
      const firstEventDate = events[0].start;
      setActiveDay(firstEventDate);
      setCurrentWeekStart(startOfWeek(firstEventDate, { weekStartsOn: 1 }));
      setHasInitializedSelection(true);
    }
  }, [events, hasInitializedSelection]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [events],
  );

  const eventDates = useMemo(
    () =>
      Array.from(
        new Set(sortedEvents.map((event) => startOfDay(event.start).getTime())),
      ).map((timestamp) => new Date(timestamp)),
    [sortedEvents],
  );

  const eventsToday = useMemo(
    () => sortedEvents.filter((event) => isSameDay(event.start, new Date())),
    [sortedEvents],
  );

  const visitsThisWeek = useMemo(() => {
    const start = startOfDay(new Date());
    const end = addDays(start, 6);
    return sortedEvents.filter(
      (event) =>
        event.type.toLowerCase().includes("visite") &&
        isWithinInterval(event.start, { start, end }),
    );
  }, [sortedEvents]);

  const pendingVisits = useMemo(
    () => visitsThisWeek.filter((event) => event.status !== "confirmed"),
    [visitsThisWeek],
  );

  const confirmedCount = useMemo(
    () => sortedEvents.filter((event) => event.status === "confirmed").length,
    [sortedEvents],
  );

  const confirmationRate = sortedEvents.length
    ? Math.round((confirmedCount / sortedEvents.length) * 100)
    : 0;

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return sortedEvents
      .filter((event) => event.end.getTime() >= now.getTime())
      .slice(0, 6);
  }, [sortedEvents]);

  const nowTimestamp = Date.now();
  const nextTodayEvent = eventsToday.find(
    (event) => event.end.getTime() >= nowTimestamp,
  );

  const statCards = [
    {
      label: "Rendez-vous aujourd'hui",
      value: eventsToday.length.toString(),
      description:
        eventsToday.length > 0
          ? nextTodayEvent
            ? `Prochain à ${format(nextTodayEvent.start, "HH:mm", { locale: fr })}`
            : "Tous les rendez-vous du jour sont terminés"
          : "Aucun rendez-vous confirmé",
      icon: CalendarCheck,
    },
    {
      label: "Visites terrain (7 jours)",
      value: visitsThisWeek.length.toString(),
      description:
        pendingVisits.length > 0
          ? `${pendingVisits.length} en attente de confirmation`
          : "Tous les créneaux sont validés",
      icon: MapPin,
    },
    {
      label: "Synchronisation Google",
      value: googleIntegration.connected
        ? capitalize(
            formatDistanceToNow(googleIntegration.lastSync, {
              locale: fr,
              addSuffix: true,
            }),
          )
        : "Non connectée",
      description: googleIntegration.connected
        ? `Calendrier: ${googleIntegration.calendarName}`
        : "Connectez votre compte Google pour synchroniser",
      icon: RefreshCw,
    },
    {
      label: "Taux de confirmation",
      value: `${confirmationRate}%`,
      description: `${confirmedCount} confirmés sur ${sortedEvents.length} événements`,
      icon: ShieldCheck,
    },
  ];

  const showEmptyState = !isLoading && sortedEvents.length === 0;
  const noOrgSelected = !currentOrgId;

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(currentWeekStart, index)),
    [currentWeekStart],
  );

  const eventsForWeek = useMemo(() => {
    const weekEnd = addDays(currentWeekStart, 7);
    return sortedEvents.filter((event) =>
      isWithinInterval(event.start, { start: currentWeekStart, end: weekEnd }),
    );
  }, [currentWeekStart, sortedEvents]);

  const eventsByDay = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    weekDays.forEach((day) => {
      const key = format(day, "yyyy-MM-dd");
      groups.set(key, []);
    });

    eventsForWeek.forEach((event) => {
      const key = format(event.start, "yyyy-MM-dd");
      const collection = groups.get(key);
      if (collection) {
        collection.push(event);
      }
    });

    weekDays.forEach((day) => {
      const key = format(day, "yyyy-MM-dd");
      const collection = groups.get(key);
      if (collection) {
        collection.sort((a, b) => a.start.getTime() - b.start.getTime());
      }
    });

    return groups;
  }, [eventsForWeek, weekDays]);

  const handleDaySelection = (date: Date) => {
    setActiveDay(date);
    setCurrentWeekStart(startOfWeek(date, { weekStartsOn: 1 }));
  };

  const goToPreviousWeek = () => {
    const newStart = addDays(currentWeekStart, -7);
    setCurrentWeekStart(newStart);
    setActiveDay((previous) => {
      const candidate = startOfDay(previous);
      if (isWithinInterval(candidate, { start: newStart, end: addDays(newStart, 6) })) {
        return previous;
      }
      return newStart;
    });
  };

  const goToNextWeek = () => {
    const newStart = addDays(currentWeekStart, 7);
    setCurrentWeekStart(newStart);
    setActiveDay((previous) => {
      const candidate = startOfDay(previous);
      if (isWithinInterval(candidate, { start: newStart, end: addDays(newStart, 6) })) {
        return previous;
      }
      return newStart;
    });
  };

  const eventsForActiveDay = useMemo(() => {
    const key = format(activeDay, "yyyy-MM-dd");
    return eventsByDay.get(key) ?? [];
  }, [activeDay, eventsByDay]);

  const DAY_START_HOUR = 8;
  const DAY_END_HOUR = 20;
  const TOTAL_DAY_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const HOUR_LABELS = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, index) => DAY_START_HOUR + index),
    [],
  );

  const computeEventPosition = (event: CalendarEvent) => {
    const columnDayStart = new Date(event.start);
    columnDayStart.setHours(DAY_START_HOUR, 0, 0, 0);
    const columnDayEnd = new Date(event.start);
    columnDayEnd.setHours(DAY_END_HOUR, 0, 0, 0);

    const clampedStart = event.start.getTime() < columnDayStart.getTime() ? columnDayStart : event.start;
    const clampedEnd = event.end.getTime() > columnDayEnd.getTime() ? columnDayEnd : event.end;

    const topMinutes = Math.max(0, differenceInMinutes(clampedStart, columnDayStart));
    const durationMinutes = Math.max(15, differenceInMinutes(clampedEnd, clampedStart));

    return {
      topPercent: (topMinutes / TOTAL_DAY_MINUTES) * 100,
      heightPercent: (durationMinutes / TOTAL_DAY_MINUTES) * 100,
    };
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Planning & Rendez-vous
            </h1>
            <p className="text-muted-foreground mt-1">
              Pilotez vos visites techniques, suivis de projet et synchronisations Google Calendar depuis un planning unifié
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Ouvrir Google Calendar
            </Button>
            <Button className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Forcer la synchronisation
            </Button>
          </div>
        </div>

        {isError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Impossible de charger les rendez-vous</p>
                <p className="text-xs text-destructive/80">
                  {error?.message ?? "Une erreur inattendue est survenue."}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="shadow-card bg-gradient-card border-0">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      {isLoading ? (
                        <>
                          <Skeleton className="mt-2 h-7 w-20" />
                          <Skeleton className="mt-2 h-3 w-32" />
                        </>
                      ) : (
                        <>
                          <p className="text-2xl font-semibold mt-2">{stat.value}</p>
                          <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                        </>
                      )}
                    </div>
                    <div className="p-3 rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
          <Card className="shadow-card bg-gradient-card border-0">
            <CardHeader className="pb-0">
              <CardTitle className="text-xl">Vue calendrier</CardTitle>
              <CardDescription>
                Naviguez semaine par semaine, positionnez vos rendez-vous et synchronisez les équipes terrain en un coup d'œil
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <div className="rounded-2xl border bg-background/80 p-4 shadow-inner">
                  <DayPicker
                    mode="single"
                    locale={fr}
                    selected={activeDay}
                    onSelect={(date) => date && handleDaySelection(date)}
                    defaultMonth={activeDay}
                    modifiers={{ event: eventDates }}
                    modifiersClassNames={{
                      event: "bg-primary/10 text-primary font-semibold",
                    }}
                  />
                  <p className="text-xs text-muted-foreground mt-4">
                    Les dates surlignées correspondent à des rendez-vous planifiés depuis EcoProRenov ou Google Calendar.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Semaine du {capitalize(format(currentWeekStart, "d MMMM", { locale: fr }))}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {isLoading
                          ? "Chargement des rendez-vous en cours..."
                          : eventsForWeek.length > 0
                            ? "Visualisez la répartition des créneaux sur la semaine et coordonnez vos équipes."
                            : noOrgSelected
                              ? "Sélectionnez une organisation pour afficher le planning."
                              : "Aucun rendez-vous n'est planifié pour cette semaine pour le moment."}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                      {isLoading
                        ? "Chargement..."
                        : `${eventsForActiveDay.length} ${eventsForActiveDay.length > 1 ? "événements le jour sélectionné" : "événement le jour sélectionné"}`}
                    </Badge>
                  </div>

                  {isLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-28 w-full rounded-2xl" />
                      ))}
                    </div>
                  ) : eventsForWeek.length === 0 ? (
                    <div className="border border-dashed border-muted-foreground/30 rounded-2xl p-8 text-center text-muted-foreground">
                      {noOrgSelected
                        ? "Sélectionnez une organisation pour visualiser les rendez-vous planifiés."
                        : "Ajoutez de nouveaux rendez-vous pour remplir votre planning hebdomadaire."}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                            Semaine précédente
                          </Button>
                          <Button variant="outline" size="sm" onClick={goToNextWeek}>
                            Semaine suivante
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {capitalize(format(currentWeekStart, "EEEE d MMMM", { locale: fr }))} – {capitalize(
                            format(addDays(currentWeekStart, 6), "EEEE d MMMM", { locale: fr }),
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {weekDays.map((day) => (
                          <button
                            key={day.toISOString()}
                            type="button"
                            onClick={() => setActiveDay(day)}
                            className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                              isSameDay(day, activeDay)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-background/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            }`}
                          >
                            <p className="font-semibold">{capitalize(format(day, "EEE d MMM", { locale: fr }))}</p>
                            <p className="text-xs text-muted-foreground">
                              {(eventsByDay.get(format(day, "yyyy-MM-dd")) ?? []).length} rendez-vous
                            </p>
                          </button>
                        ))}
                      </div>

                      <ScrollArea className="h-[720px]">
                        <div className="min-w-[960px]">
                          <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] gap-px rounded-2xl border bg-border/60">
                            <div className="bg-background p-3 text-right text-xs font-semibold text-muted-foreground">
                              Heures
                            </div>
                            {weekDays.map((day) => (
                              <div
                                key={`header-${day.toISOString()}`}
                                className={`bg-background p-3 text-center text-sm font-semibold ${
                                  isSameDay(day, activeDay) ? "text-primary" : "text-foreground"
                                }`}
                              >
                                {capitalize(format(day, "EEEE d MMM", { locale: fr }))}
                              </div>
                            ))}

                            <div className="relative bg-background" style={{ height: `${TOTAL_DAY_MINUTES}px` }}>
                              {HOUR_LABELS.map((hour) => (
                                <div
                                  key={`hour-${hour}`}
                                  className="flex h-[60px] items-start justify-end pr-3 text-xs text-muted-foreground"
                                >
                                  {`${hour.toString().padStart(2, "0")}:00`}
                                </div>
                              ))}
                            </div>

                            {weekDays.map((day) => {
                              const key = format(day, "yyyy-MM-dd");
                              const eventsForDay = eventsByDay.get(key) ?? [];

                              return (
                                <div
                                  key={`column-${day.toISOString()}`}
                                  className="relative bg-background"
                                  style={{ height: `${TOTAL_DAY_MINUTES}px` }}
                                >
                                  {HOUR_LABELS.map((hour, index) => (
                                    <div
                                      key={`gridline-${hour}-${index}`}
                                      className="absolute left-0 right-0 border-b border-dashed border-border/60"
                                      style={{ top: `${((hour - DAY_START_HOUR) * 60 * 100) / TOTAL_DAY_MINUTES}%` }}
                                    />
                                  ))}

                                  {eventsForDay.map((event) => {
                                    const StatusIcon = statusConfig[event.status].icon;
                                    const { topPercent, heightPercent } = computeEventPosition(event);
                                    const isPlaceholderLocation = event.location === "Adresse à confirmer";

                                    return (
                                      <div
                                        key={event.id}
                                        className="absolute left-2 right-2 rounded-xl border bg-background/95 p-3 shadow-sm transition hover:shadow-md"
                                        style={{ top: `${topPercent}%`, height: `${heightPercent}%` }}
                                      >
                                        <div className="flex items-start justify-between gap-2 text-xs">
                                          <span className="font-semibold text-foreground">
                                            {format(event.start, "HH:mm", { locale: fr })} – {format(event.end, "HH:mm", { locale: fr })}
                                          </span>
                                          <Badge variant="outline" className={`${event.typeColor} px-2 py-0 text-[10px]`}>
                                            {event.type}
                                          </Badge>
                                        </div>
                                        <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">
                                          {event.title}
                                        </p>
                                        <p
                                          className={`mt-1 text-xs text-muted-foreground ${
                                            isPlaceholderLocation ? "italic" : ""
                                          }`}
                                        >
                                          {event.location}
                                        </p>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                          <span className="inline-flex items-center gap-1">
                                            <Users className="h-3.5 w-3.5" />
                                            {event.assignedTo}
                                          </span>
                                          <span className={`inline-flex items-center gap-1 ${statusConfig[event.status].className}`}>
                                            <StatusIcon className="h-3.5 w-3.5" />
                                            {statusConfig[event.status].label}
                                          </span>
                                          <Badge
                                            variant="outline"
                                            className={`${sourceLabels[event.source].className} px-2 py-0 text-[10px]`}
                                          >
                                            {sourceLabels[event.source].label}
                                          </Badge>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-card bg-gradient-card border-0">
              <CardHeader className="pb-0">
                <CardTitle className="text-xl">Prochains rendez-vous</CardTitle>
                <CardDescription>
                  Synchronisés automatiquement depuis vos équipes EcoProRenov et Google Calendar
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ScrollArea className="h-[360px]">
                  {isLoading ? (
                    <div className="space-y-4 pr-2">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-28 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : upcomingEvents.length === 0 ? (
                    <div className="border border-dashed border-muted-foreground/30 rounded-2xl p-6 text-center text-sm text-muted-foreground">
                      {showEmptyState
                        ? "Aucun rendez-vous planifié n'est disponible pour le moment."
                        : "Aucun rendez-vous à venir."}
                    </div>
                  ) : (
                    <div className="space-y-4 pr-2">
                      {upcomingEvents.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-xl border bg-background/80 p-4 shadow-sm space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                {capitalize(format(event.start, "EEEE d MMMM", { locale: fr }))}
                              </p>
                              <h4 className="text-sm font-semibold text-foreground mt-1">
                                {event.title}
                              </h4>
                            </div>
                            <Badge variant="outline" className={event.typeColor}>
                              {event.type}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="h-4 w-4" />
                              {format(event.start, "HH:mm", { locale: fr })} – {format(event.end, "HH:mm", { locale: fr })}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-4 w-4" />
                              {event.location}
                            </span>
                            <Badge
                              variant="outline"
                              className={`${sourceLabels[event.source].className} px-2 py-0`}
                            >
                              {sourceLabels[event.source].label}
                            </Badge>
                          </div>
                          {event.detailUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-0 inline-flex items-center gap-1.5 text-primary hover:text-primary"
                              asChild
                            >
                              <Link to={event.detailUrl}>
                                <ExternalLink className="h-4 w-4" />
                                {event.detailLabel ?? (event.entityType === "project" ? "Voir le projet" : "Voir le lead")}
                              </Link>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="shadow-card bg-gradient-card border-0">
              <CardHeader>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">Intégration Google Calendar</CardTitle>
                      <CardDescription>
                        Synchronisez automatiquement les créneaux avec les agendas de vos équipes
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        googleIntegration.connected
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                          : "bg-rose-500/10 text-rose-600 border-rose-200"
                      }
                    >
                      {googleIntegration.connected ? "Connecté" : "Déconnecté"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Dernière synchronisation {capitalize(
                      formatDistanceToNow(googleIntegration.lastSync, {
                        locale: fr,
                        addSuffix: true,
                      }),
                    )}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl border bg-background/70 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {googleIntegration.calendarName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Compte principal : {googleIntegration.primaryEmail}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Re-synchroniser
                      </Button>
                      <Button size="sm" className="gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Gérer les accès
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">
                    Étapes pour lier un nouveau calendrier
                  </h4>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Créer un projet Google Cloud et activer l'API Calendar.</li>
                    <li>Configurer un identifiant OAuth 2.0 avec l'URL de redirection de votre instance EcoProRenov.</li>
                    <li>Ajouter l'adresse {googleIntegration.primaryEmail} comme invité avec droits de modification.</li>
                    <li>Définir les calendriers à synchroniser depuis le module Paramètres &gt; Intégrations.</li>
                  </ol>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    Scopes OAuth recommandés
                  </h4>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="bg-muted/40">
                      https://www.googleapis.com/auth/calendar
                    </Badge>
                    <Badge variant="outline" className="bg-muted/40">
                      https://www.googleapis.com/auth/calendar.events
                    </Badge>
                  </div>
                </div>

                <Separator />

                <p className="text-xs text-muted-foreground">
                  Astuce : utilisez les tags de projet dans EcoProRenov pour filtrer automatiquement les événements publiés vers
                  vos calendriers Google (commerciaux, techniciens, poseurs…).
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CalendarPage;
