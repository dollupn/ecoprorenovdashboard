import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FieldType = "text" | "number" | "select" | "textarea" | "checkbox";

type DynamicField = {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  defaultValue?: string | number | boolean;
};

type DynamicFieldsEditorProps = {
  value: {
    schema: DynamicField[] | Record<string, DynamicField> | null | undefined;
    defaults: Record<string, any>;
  };
  onChange: (value: { schema: DynamicField[]; defaults: Record<string, any> }) => void;
  disabled?: boolean;
};

const normalizeSchema = (
  schema: DynamicFieldsEditorProps["value"]["schema"],
): DynamicField[] => {
  if (!schema) {
    return [];
  }

  if (Array.isArray(schema)) {
    return schema;
  }

  return Object.values(schema);
};

export const DynamicFieldsEditor = ({ value, onChange, disabled }: DynamicFieldsEditorProps) => {
  const [fields, setFields] = useState<DynamicField[]>(() => normalizeSchema(value.schema));

  const updateParent = useCallback(
    (updatedFields: DynamicField[]) => {
      const defaults: Record<string, any> = {};
      updatedFields.forEach((field) => {
        if (field.defaultValue !== undefined) {
          defaults[field.name] = field.defaultValue;
        }
      });
      onChange({ schema: updatedFields, defaults });
    },
    [onChange],
  );

  useEffect(() => {
    const normalizedSchema = normalizeSchema(value.schema);
    const fieldsWithDefaults = normalizedSchema.map((field) => {
      const defaultValue = value.defaults?.[field.name];
      if (defaultValue === undefined) {
        return { ...field };
      }
      return { ...field, defaultValue };
    });
    const shouldForceUpdate = !Array.isArray(value.schema);

    setFields((previousFields) => {
      const hasSchemaChanged =
        JSON.stringify(previousFields) !== JSON.stringify(fieldsWithDefaults);

      if (hasSchemaChanged || shouldForceUpdate) {
        updateParent(fieldsWithDefaults);
        return fieldsWithDefaults;
      }

      return previousFields;
    });
  }, [updateParent, value.defaults, value.schema]);

  const addField = () => {
    const newField: DynamicField = {
      id: `field_${Date.now()}`,
      name: "",
      label: "",
      type: "text",
      required: false,
    };
    const updatedFields = [...fields, newField];
    setFields(updatedFields);
    updateParent(updatedFields);
  };

  const removeField = (id: string) => {
    const updatedFields = fields.filter((f) => f.id !== id);
    setFields(updatedFields);
    updateParent(updatedFields);
  };

  const updateField = (id: string, updates: Partial<DynamicField>) => {
    const updatedFields = fields.map((f) => (f.id === id ? { ...f, ...updates } : f));
    setFields(updatedFields);
    updateParent(updatedFields);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">Champs dynamiques</h4>
          <p className="text-xs text-muted-foreground">
            Ajoutez des champs personnalisés pour ce produit
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addField} disabled={disabled}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </div>

      {fields.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-sm text-muted-foreground">
              Aucun champ dynamique. Cliquez sur "Ajouter" pour en créer un.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {fields.map((field) => (
            <Card key={field.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm">Configuration du champ</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(field.id)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`${field.id}-name`}>Nom technique</Label>
                    <Input
                      id={`${field.id}-name`}
                      value={field.name}
                      onChange={(e) => updateField(field.id, { name: e.target.value })}
                      placeholder="surface_m2"
                      disabled={disabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${field.id}-label`}>Label</Label>
                    <Input
                      id={`${field.id}-label`}
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      placeholder="Surface (m²)"
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`${field.id}-type`}>Type</Label>
                    <Select
                      value={field.type}
                      onValueChange={(type) => updateField(field.id, { type: type as FieldType })}
                      disabled={disabled}
                    >
                      <SelectTrigger id={`${field.id}-type`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Texte</SelectItem>
                        <SelectItem value="number">Nombre</SelectItem>
                        <SelectItem value="select">Liste déroulante</SelectItem>
                        <SelectItem value="textarea">Texte long</SelectItem>
                        <SelectItem value="checkbox">Case à cocher</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${field.id}-default`}>Valeur par défaut</Label>
                    {field.type === "checkbox" ? (
                      <div className="flex items-center h-10">
                        <Switch
                          id={`${field.id}-default`}
                          checked={Boolean(field.defaultValue)}
                          onCheckedChange={(checked) => updateField(field.id, { defaultValue: checked })}
                          disabled={disabled}
                        />
                      </div>
                    ) : (
                      <Input
                        id={`${field.id}-default`}
                        type={field.type === "number" ? "number" : "text"}
                        value={field.defaultValue?.toString() || ""}
                        onChange={(e) =>
                          updateField(field.id, {
                            defaultValue: field.type === "number" ? Number(e.target.value) : e.target.value,
                          })
                        }
                        disabled={disabled}
                      />
                    )}
                  </div>
                </div>

                {field.type === "select" && (
                  <div className="space-y-2">
                    <Label htmlFor={`${field.id}-options`}>Options (séparées par des virgules)</Label>
                    <Input
                      id={`${field.id}-options`}
                      value={field.options?.join(", ") || ""}
                      onChange={(e) =>
                        updateField(field.id, {
                          options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean),
                        })
                      }
                      placeholder="Option 1, Option 2, Option 3"
                      disabled={disabled}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Switch
                    id={`${field.id}-required`}
                    checked={field.required}
                    onCheckedChange={(checked) => updateField(field.id, { required: checked })}
                    disabled={disabled}
                  />
                  <Label htmlFor={`${field.id}-required`}>Champ requis</Label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
