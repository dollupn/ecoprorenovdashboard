import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  KPI_METRIC_OPTIONS,
  KPI_PERIOD_OPTIONS,
  getKpiMetricDefaultUnit,
  getKpiMetricDescription,
  kpiGoalSchema,
  type KpiGoalFormValues,
} from "@/lib/kpi-goals";

interface KpiGoalFormProps {
  defaultValues?: Partial<KpiGoalFormValues>;
  onSubmit: (values: KpiGoalFormValues) => void;
  onCancel?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export function KpiGoalForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel = "Enregistrer",
  isSubmitting = false,
}: KpiGoalFormProps) {
  const defaultMetric = defaultValues?.metric ?? KPI_METRIC_OPTIONS[0].value;
  const defaultUnit = defaultValues?.targetUnit ?? getKpiMetricDefaultUnit(defaultMetric);

  const form = useForm<KpiGoalFormValues>({
    resolver: zodResolver(kpiGoalSchema),
    defaultValues: {
      id: defaultValues?.id,
      orgId: defaultValues?.orgId,
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      metric: defaultMetric,
      period: defaultValues?.period ?? KPI_PERIOD_OPTIONS[0].value,
      targetValue: defaultValues?.targetValue ?? 0,
      targetUnit: defaultUnit ?? "",
      isActive: defaultValues?.isActive ?? true,
    },
  });

  useEffect(() => {
    form.reset({
      id: defaultValues?.id,
      orgId: defaultValues?.orgId,
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      metric: defaultValues?.metric ?? KPI_METRIC_OPTIONS[0].value,
      period: defaultValues?.period ?? KPI_PERIOD_OPTIONS[0].value,
      targetValue: defaultValues?.targetValue ?? 0,
      targetUnit:
        defaultValues?.targetUnit ??
        getKpiMetricDefaultUnit(defaultValues?.metric ?? KPI_METRIC_OPTIONS[0].value) ??
          "",
      isActive: defaultValues?.isActive ?? true,
    });
  }, [defaultValues, form]);

  const isPending = form.formState.isSubmitting || isSubmitting;

  const metricValue = form.watch("metric");
  const metricDescription = useMemo(
    () => getKpiMetricDescription(metricValue),
    [metricValue],
  );

  useEffect(() => {
    const defaultUnit = getKpiMetricDefaultUnit(metricValue);
    const currentUnit = form.getValues("targetUnit");
    if (!currentUnit && defaultUnit) {
      form.setValue("targetUnit", defaultUnit, { shouldValidate: false });
    }
  }, [form, metricValue]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom de l'objectif</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Revenu signé mensuel"
                    {...field}
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="metric"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Indicateur suivi</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisissez un indicateur" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {KPI_METRIC_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>{metricDescription}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="targetValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valeur cible</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex : 25000"
                    value={Number.isFinite(field.value) ? field.value : 0}
                    onChange={(event) => {
                      const { value } = event.target;
                      field.onChange(value === "" ? 0 : Number(value));
                    }}
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="targetUnit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unité</FormLabel>
                <FormControl>
                  <Input
                    placeholder="€, % ou autre unité"
                    {...field}
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="period"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Période de suivi</FormLabel>
                <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une période" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {KPI_PERIOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Ajoutez des précisions sur la manière de calculer cet objectif."
                  className="min-h-[100px]"
                  {...field}
                  disabled={isPending}
                />
              </FormControl>
              <FormDescription>
                Visible uniquement pour l'équipe interne afin de contextualiser l'objectif.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="space-y-1">
                <FormLabel>Activer l'objectif</FormLabel>
                <FormDescription>
                  Contrôle la prise en compte de cet objectif dans les tableaux de bord et rapports.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex items-center justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
              Annuler
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
