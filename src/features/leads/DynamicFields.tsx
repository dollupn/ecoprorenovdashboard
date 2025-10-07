import { Fragment } from "react";
import { ControllerRenderProps, UseFormReturn } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { DynamicFieldSchema, ProductFormSchema } from "./api";

type DynamicFieldsProps<TFormValues extends { extra_fields?: Record<string, unknown> }> = {
  form: UseFormReturn<TFormValues>;
  schema?: ProductFormSchema | null;
  disabled?: boolean;
};

export const DynamicFields = <TFormValues extends { extra_fields?: Record<string, unknown> }>({
  form,
  schema,
  disabled,
}: DynamicFieldsProps<TFormValues>) => {
  if (!schema || !schema.fields?.length) {
    return null;
  }

  const renderFieldControl = (
    fieldConfig: DynamicFieldSchema,
    field: ControllerRenderProps<TFormValues, `extra_fields.${string}`>
  ) => {
    switch (fieldConfig.type) {
      case "textarea":
        return (
          <Textarea
            value={(field.value as string | undefined) ?? ""}
            onChange={(event) => field.onChange(event.target.value)}
            disabled={disabled}
            rows={3}
            placeholder={fieldConfig.placeholder}
          />
        );
      case "select":
        return (
          <Select
            onValueChange={(value) => field.onChange(value)}
            value={(field.value as string | undefined) ?? ""}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={fieldConfig.placeholder ?? "Sélectionner"} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {(fieldConfig.options ?? []).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "number":
        return (
          <Input
            type="number"
            value={field.value ?? ""}
            disabled={disabled}
            min={fieldConfig.min}
            max={fieldConfig.max}
            placeholder={fieldConfig.placeholder}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === "") {
                field.onChange(undefined);
                return;
              }
              const parsed = Number(raw);
              field.onChange(Number.isNaN(parsed) ? undefined : parsed);
            }}
          />
        );
      default:
        return (
          <Input
            type="text"
            value={(field.value as string | undefined) ?? ""}
            disabled={disabled}
            placeholder={fieldConfig.placeholder}
            onChange={(event) => field.onChange(event.target.value)}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      {schema.title ? (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground">{schema.title}</h3>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {schema.fields.map((fieldConfig) => (
          <Fragment key={fieldConfig.name}>
            <FormField
              control={form.control}
              name={`extra_fields.${fieldConfig.name}` as const}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {fieldConfig.label}
                    {fieldConfig.required ? <span className="text-destructive"> *</span> : null}
                  </FormLabel>
                  <FormControl>
                    {renderFieldControl(fieldConfig, field)}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </Fragment>
        ))}
      </div>
    </div>
  );
};
