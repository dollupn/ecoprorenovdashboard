import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LeadProductTypesManager } from "@/features/leads/LeadProductTypesManager";
import {
  getLeadSources,
  saveLeadSources,
  resetLeadSources,
  sortLeadSources,
  type LeadSourceSetting,
  type LeadSourceChannel,
  getLeadSourceChannelLabel,
  getLeadSourceChannelDescription,
  getLeadStatusSettings,
  saveLeadStatusSettings,
  resetLeadStatusSettings,
  sortLeadStatusSettings,
  type LeadStatusSetting,
  getLeadDynamicFields,
  saveLeadDynamicFields,
  resetLeadDynamicFields,
  sortLeadDynamicFields,
  type LeadDynamicFieldSetting,
  type LeadDynamicFieldType,
  getLeadAutomationSettings,
  saveLeadAutomationSettings,
  resetLeadAutomationSettings,
  type LeadAutomationSettings,
} from "@/lib/leads";
import {
  Boxes,
  Database,
  List,
  Settings2,
  Tags,
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
  Save,
  Undo2,
  RefreshCw,
} from "lucide-react";

const CHANNEL_OPTIONS: { value: LeadSourceChannel; label: string; description: string }[] = (
  ["digital", "recommendation", "partner", "event", "outbound", "other"] as LeadSourceChannel[]
).map((value) => ({
  value,
  label: getLeadSourceChannelLabel(value),
  description: getLeadSourceChannelDescription(value),
}));

const FIELD_TYPE_OPTIONS: { value: LeadDynamicFieldType; label: string }[] = [
  { value: "text", label: "Texte court" },
  { value: "textarea", label: "Zone de texte" },
  { value: "number", label: "Nombre" },
  { value: "select", label: "Liste déroulante" },
];

const ASSIGNMENT_STRATEGIES = [
  { value: "round_robin" as const, label: "Rotation équitable" },
  { value: "load_balanced" as const, label: "Charge restante" },
  { value: "manual" as const, label: "Affectation manuelle" },
];

type MutableLeadSource = LeadSourceSetting;
type MutableLeadStatus = LeadStatusSetting;
type MutableLeadDynamicField = LeadDynamicFieldSetting;

type NewSourceState = { name: string; channel: LeadSourceChannel; description: string };
type NewFieldState = {
  label: string;
  type: LeadDynamicFieldType;
  placeholder: string;
  required: boolean;
  options: string;
  min: string;
  max: string;
};

const generateId = (prefix: string) => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
};

const reassignOrder = <T extends { order: number }>(items: T[]) =>
  items.map((item, index) => ({ ...item, order: index + 1 }));

export function LeadSettingsPanel() {
  const { toast } = useToast();

  const [sources, setSources] = useState<MutableLeadSource[]>(() =>
    sortLeadSources(getLeadSources({ includeInactive: true }))
  );
  const [statusSettings, setStatusSettings] = useState<MutableLeadStatus[]>(() =>
    sortLeadStatusSettings(getLeadStatusSettings({ includeInactive: true }))
  );
  const [dynamicFields, setDynamicFields] = useState<MutableLeadDynamicField[]>(() =>
    sortLeadDynamicFields(getLeadDynamicFields({ includeInactive: true }))
  );
  const [automationSettings, setAutomationSettings] = useState<LeadAutomationSettings>(
    () => getLeadAutomationSettings()
  );

  const [sourcesDirty, setSourcesDirty] = useState(false);
  const [statusesDirty, setStatusesDirty] = useState(false);
  const [fieldsDirty, setFieldsDirty] = useState(false);
  const [automationDirty, setAutomationDirty] = useState(false);

  const [newSource, setNewSource] = useState<NewSourceState>({
    name: "",
    channel: "digital",
    description: "",
  });

  const [newField, setNewField] = useState<NewFieldState>({
    label: "",
    type: "text",
    placeholder: "",
    required: false,
    options: "",
    min: "",
    max: "",
  });

  useEffect(() => {
    if (!statusSettings.some((status) => status.value === automationSettings.autoArchiveStatus)) {
      const fallback =
        statusSettings.find((status) => status.isActive)?.value ?? automationSettings.autoArchiveStatus;
      setAutomationSettings((prev) => ({
        ...prev,
        autoArchiveStatus: fallback,
      }));
      setAutomationDirty(true);
    }
  }, [statusSettings, automationSettings.autoArchiveStatus]);

  const handleAddSource = () => {
    const trimmedName = newSource.name.trim();
    if (!trimmedName) {
      toast({
        title: "Nom requis",
        description: "Veuillez saisir un nom de source.",
        variant: "destructive",
      });
      return;
    }

    setSources((previous) =>
      sortLeadSources([
        ...previous,
        {
          id: generateId("lead-source"),
          name: trimmedName,
          channel: newSource.channel,
          description: newSource.description.trim(),
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
    );
    setNewSource({ name: "", channel: newSource.channel, description: "" });
    setSourcesDirty(true);
  };

  const handleUpdateSource = (id: string, updates: Partial<MutableLeadSource>) => {
    setSources((previous) =>
      previous.map((source) =>
        source.id === id
          ? {
              ...source,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : source
      )
    );
    setSourcesDirty(true);
  };

  const handleDeleteSource = (id: string) => {
    setSources((previous) => previous.filter((source) => source.id !== id));
    setSourcesDirty(true);
  };

  const handleSaveSources = () => {
    const saved = saveLeadSources(sources);
    setSources(sortLeadSources(saved));
    setSourcesDirty(false);
    toast({ title: "Sources enregistrées" });
  };

  const handleResetSources = () => {
    const defaults = resetLeadSources();
    setSources(sortLeadSources(defaults));
    setSourcesDirty(false);
    toast({ title: "Sources réinitialisées" });
  };

  const handleMoveStatus = (index: number, direction: -1 | 1) => {
    setStatusSettings((previous) => {
      const next = [...previous];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return previous;
      const [current] = next.splice(index, 1);
      next.splice(targetIndex, 0, current);
      setStatusesDirty(true);
      return reassignOrder(next);
    });
  };

  const handleUpdateStatus = (id: string, updates: Partial<MutableLeadStatus>) => {
    setStatusSettings((previous) =>
      previous.map((status) =>
        status.id === id
          ? {
              ...status,
              ...updates,
            }
          : status
      )
    );
    setStatusesDirty(true);
  };

  const handleSaveStatuses = () => {
    const saved = saveLeadStatusSettings(statusSettings);
    setStatusSettings(sortLeadStatusSettings(saved));
    setStatusesDirty(false);
    toast({ title: "Statuts mis à jour" });
  };

  const handleResetStatuses = () => {
    const defaults = resetLeadStatusSettings();
    setStatusSettings(sortLeadStatusSettings(defaults));
    setStatusesDirty(false);
    toast({ title: "Statuts réinitialisés" });
  };

  const handleAddField = () => {
    const trimmedLabel = newField.label.trim();
    if (!trimmedLabel) {
      toast({
        title: "Libellé requis",
        description: "Veuillez indiquer un nom pour le champ.",
        variant: "destructive",
      });
      return;
    }

    const options =
      newField.type === "select"
        ? newField.options
            .split(",")
            .map((option) => option.trim())
            .filter((option) => option.length > 0)
        : undefined;

    setDynamicFields((previous) =>
      reassignOrder([
        ...previous,
        {
          id: generateId("lead-field"),
          name: trimmedLabel,
          label: trimmedLabel,
          type: newField.type,
          placeholder: newField.placeholder.trim(),
          required: newField.required,
          options,
          min: newField.type === "number" && newField.min !== "" ? Number(newField.min) : null,
          max: newField.type === "number" && newField.max !== "" ? Number(newField.max) : null,
          helperText: undefined,
          order: previous.length + 1,
          isActive: true,
        },
      ])
    );
    setFieldsDirty(true);
    setNewField({ label: "", type: "text", placeholder: "", required: false, options: "", min: "", max: "" });
  };

  const handleUpdateField = (id: string, updates: Partial<MutableLeadDynamicField>) => {
    setDynamicFields((previous) =>
      previous.map((field) =>
        field.id === id
          ? {
              ...field,
              ...updates,
            }
          : field
      )
    );
    setFieldsDirty(true);
  };

  const handleMoveField = (index: number, direction: -1 | 1) => {
    setDynamicFields((previous) => {
      const next = [...previous];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return previous;
      const [current] = next.splice(index, 1);
      next.splice(targetIndex, 0, current);
      setFieldsDirty(true);
      return reassignOrder(next);
    });
  };

  const handleDeleteField = (id: string) => {
    setDynamicFields((previous) => reassignOrder(previous.filter((field) => field.id !== id)));
    setFieldsDirty(true);
  };

  const handleSaveFields = () => {
    const saved = saveLeadDynamicFields(dynamicFields);
    setDynamicFields(sortLeadDynamicFields(saved));
    setFieldsDirty(false);
    toast({ title: "Champs enregistrés" });
  };

  const handleResetFields = () => {
    const defaults = resetLeadDynamicFields();
    setDynamicFields(sortLeadDynamicFields(defaults));
    setFieldsDirty(false);
    toast({ title: "Champs réinitialisés" });
  };

  const handleSaveAutomation = () => {
    const saved = saveLeadAutomationSettings(automationSettings);
    setAutomationSettings(saved);
    setAutomationDirty(false);
    toast({ title: "Automatisation enregistrée" });
  };

  const handleResetAutomation = () => {
    const defaults = resetLeadAutomationSettings();
    setAutomationSettings(defaults);
    setAutomationDirty(false);
    toast({ title: "Paramètres réinitialisés" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Paramètres Lead</h2>
        <p className="text-muted-foreground">
          Configuration et personnalisation de la gestion des leads.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5" />
              Types de produit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gérez les types de produit utilisés lors de la création d'un lead. Ces catégories servent de
              base pour différencier vos offres (ex. Isolation, LED).
            </p>
            <LeadProductTypesManager />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              Sources de leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Ajouter une source</Label>
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  placeholder="Nom de la source"
                  value={newSource.name}
                  onChange={(event) => setNewSource((prev) => ({ ...prev, name: event.target.value }))}
                />
                <Select
                  value={newSource.channel}
                  onValueChange={(value: LeadSourceChannel) =>
                    setNewSource((prev) => ({ ...prev, channel: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Description (optionnelle)"
                  value={newSource.description}
                  onChange={(event) =>
                    setNewSource((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleAddSource} disabled={!newSource.name.trim()}>
                  <Plus className="mr-2 h-4 w-4" /> Ajouter
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {sources.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune source définie pour le moment. Ajoutez vos canaux d'acquisition principaux ci-dessus.
                </p>
              ) : (
                sources.map((source, index) => (
                  <div key={source.id} className="space-y-4 rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="secondary">Source #{index + 1}</Badge>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={source.isActive}
                            onCheckedChange={(checked) =>
                              handleUpdateSource(source.id, { isActive: checked })
                            }
                          />
                          <span className="text-sm text-muted-foreground">Active</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSource(source.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nom</Label>
                        <Input
                          value={source.name}
                          onChange={(event) =>
                            handleUpdateSource(source.id, { name: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Canal</Label>
                        <Select
                          value={source.channel}
                          onValueChange={(value: LeadSourceChannel) =>
                            handleUpdateSource(source.id, { channel: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent>
                            {CHANNEL_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {CHANNEL_OPTIONS.find((option) => option.value === source.channel)?.description}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={source.description ?? ""}
                        onChange={(event) =>
                          handleUpdateSource(source.id, { description: event.target.value })
                        }
                        rows={2}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleResetSources} disabled={!sourcesDirty}>
                <Undo2 className="mr-2 h-4 w-4" /> Réinitialiser
              </Button>
              <Button onClick={handleSaveSources} disabled={!sourcesDirty}>
                <Save className="mr-2 h-4 w-4" /> Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              Statuts personnalisés
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Ajustez le libellé, la couleur et les délais de suivi pour chacun des statuts disponibles.
            </p>
            <div className="space-y-4">
              {statusSettings.map((status, index) => (
                <div key={status.id} className="space-y-4 rounded-md border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{status.value}</Badge>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Position</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveStatus(index, -1)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveStatus(index, 1)}
                          disabled={index === statusSettings.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={status.isActive}
                        onCheckedChange={(checked) =>
                          handleUpdateStatus(status.id, { isActive: checked })
                        }
                      />
                      <span className="text-sm text-muted-foreground">Visible</span>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Libellé affiché</Label>
                      <Input
                        value={status.label}
                        onChange={(event) =>
                          handleUpdateStatus(status.id, { label: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Couleur</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={status.color}
                          onChange={(event) =>
                            handleUpdateStatus(status.id, { color: event.target.value })
                          }
                          className="h-10 w-16"
                        />
                        <Input
                          value={status.color}
                          onChange={(event) =>
                            handleUpdateStatus(status.id, { color: event.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={status.description}
                        onChange={(event) =>
                          handleUpdateStatus(status.id, { description: event.target.value })
                        }
                        rows={2}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Délai de suivi (heures)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={status.followUpHours}
                          onChange={(event) =>
                            handleUpdateStatus(status.id, {
                              followUpHours: Number(event.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Probabilité de conversion (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={status.probability ?? ""}
                          onChange={(event) => {
                            const raw = event.target.value;
                            handleUpdateStatus(status.id, {
                              probability: raw === "" ? undefined : Math.min(100, Math.max(0, Number(raw))),
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleResetStatuses} disabled={!statusesDirty}>
                <Undo2 className="mr-2 h-4 w-4" /> Réinitialiser
              </Button>
              <Button onClick={handleSaveStatuses} disabled={!statusesDirty}>
                <Save className="mr-2 h-4 w-4" /> Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Champs dynamiques
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Ajoutez des champs personnalisés selon vos besoins métier. Ils seront affichés dans le formulaire de création de lead.
            </p>
            <div className="space-y-2">
              <Label>Nouveau champ</Label>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Libellé du champ"
                  value={newField.label}
                  onChange={(event) => setNewField((prev) => ({ ...prev, label: event.target.value }))}
                />
                <Select
                  value={newField.type}
                  onValueChange={(value: LeadDynamicFieldType) =>
                    setNewField((prev) => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Texte d'aide (optionnel)"
                  value={newField.placeholder}
                  onChange={(event) =>
                    setNewField((prev) => ({ ...prev, placeholder: event.target.value }))
                  }
                />
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newField.required}
                    onCheckedChange={(checked) => setNewField((prev) => ({ ...prev, required: checked }))}
                  />
                  <span className="text-sm text-muted-foreground">Champ obligatoire</span>
                </div>
              </div>
              {newField.type === "select" && (
                <Textarea
                  placeholder="Options séparées par une virgule"
                  value={newField.options}
                  onChange={(event) =>
                    setNewField((prev) => ({ ...prev, options: event.target.value }))
                  }
                  rows={2}
                />
              )}
              {newField.type === "number" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    type="number"
                    placeholder="Valeur minimale"
                    value={newField.min}
                    onChange={(event) =>
                      setNewField((prev) => ({ ...prev, min: event.target.value }))
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Valeur maximale"
                    value={newField.max}
                    onChange={(event) =>
                      setNewField((prev) => ({ ...prev, max: event.target.value }))
                    }
                  />
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleAddField} disabled={!newField.label.trim()}>
                  <Plus className="mr-2 h-4 w-4" /> Ajouter
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {dynamicFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun champ dynamique défini. Ajoutez vos champs spécifiques (surface, usage, notes...) ci-dessus.
                </p>
              ) : (
                dynamicFields.map((field, index) => (
                  <div key={field.id} className="space-y-4 rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Badge variant="outline">Champ #{index + 1}</Badge>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={field.isActive}
                          onCheckedChange={(checked) => handleUpdateField(field.id, { isActive: checked })}
                        />
                        <span className="text-sm text-muted-foreground">Visible</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveField(index, -1)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleMoveField(index, 1)}
                          disabled={index === dynamicFields.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteField(field.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Libellé</Label>
                        <Input
                          value={field.label}
                          onChange={(event) => handleUpdateField(field.id, { label: event.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(value: LeadDynamicFieldType) =>
                            handleUpdateField(field.id, { type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Texte d'aide</Label>
                        <Input
                          value={field.placeholder ?? ""}
                          onChange={(event) =>
                            handleUpdateField(field.id, { placeholder: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Obligatoire</Label>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={field.required}
                            onCheckedChange={(checked) => handleUpdateField(field.id, { required: checked })}
                          />
                          <span className="text-sm text-muted-foreground">
                            Le champ doit être renseigné
                          </span>
                        </div>
                      </div>
                    </div>
                    {field.type === "select" ? (
                      <div className="space-y-2">
                        <Label>Options (séparées par une virgule)</Label>
                        <Textarea
                          value={(field.options ?? []).join(", ")}
                          onChange={(event) =>
                            handleUpdateField(field.id, {
                              options: event.target.value
                                .split(",")
                                .map((option) => option.trim())
                                .filter((option) => option.length > 0),
                            })
                          }
                          rows={2}
                        />
                      </div>
                    ) : null}
                    {field.type === "number" ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Valeur minimale</Label>
                          <Input
                            type="number"
                            value={field.min ?? ""}
                            onChange={(event) =>
                              handleUpdateField(field.id, {
                                min: event.target.value === "" ? null : Number(event.target.value),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Valeur maximale</Label>
                          <Input
                            type="number"
                            value={field.max ?? ""}
                            onChange={(event) =>
                              handleUpdateField(field.id, {
                                max: event.target.value === "" ? null : Number(event.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleResetFields} disabled={!fieldsDirty}>
                <Undo2 className="mr-2 h-4 w-4" /> Réinitialiser
              </Button>
              <Button onClick={handleSaveFields} disabled={!fieldsDirty}>
                <Save className="mr-2 h-4 w-4" /> Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Automatisation & notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-border p-4">
                <div>
                  <p className="font-medium">Affectation automatique</p>
                  <p className="text-sm text-muted-foreground">
                    Distribue les nouveaux leads selon la stratégie sélectionnée.
                  </p>
                </div>
                <Switch
                  checked={automationSettings.autoAssignEnabled}
                  onCheckedChange={(checked) => {
                    setAutomationSettings((prev) => ({ ...prev, autoAssignEnabled: checked }));
                    setAutomationDirty(true);
                  }}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Stratégie d'affectation</Label>
                  <Select
                    value={automationSettings.assignmentStrategy}
                    onValueChange={(value: LeadAutomationSettings["assignmentStrategy"]) => {
                      setAutomationSettings((prev) => ({ ...prev, assignmentStrategy: value }));
                      setAutomationDirty(true);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNMENT_STRATEGIES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Statut d'archivage automatique</Label>
                  <Select
                    value={automationSettings.autoArchiveStatus}
                    onValueChange={(value: LeadAutomationSettings["autoArchiveStatus"]) => {
                      setAutomationSettings((prev) => ({ ...prev, autoArchiveStatus: value }));
                      setAutomationDirty(true);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusSettings.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Délai avant archivage (jours)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={automationSettings.autoArchiveAfterDays}
                    onChange={(event) => {
                      setAutomationSettings((prev) => ({
                        ...prev,
                        autoArchiveAfterDays: Number(event.target.value) || 0,
                      }));
                      setAutomationDirty(true);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Détection de doublons (heures)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={automationSettings.duplicateDetectionWindowHours}
                    onChange={(event) => {
                      setAutomationSettings((prev) => ({
                        ...prev,
                        duplicateDetectionWindowHours: Number(event.target.value) || 1,
                      }));
                      setAutomationDirty(true);
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center justify-between rounded-md border border-border p-4">
                  <div>
                    <p className="font-medium">Inclure les managers dans la rotation</p>
                    <p className="text-sm text-muted-foreground">
                      Les managers recevront également des leads lorsqu'ils sont actifs.
                    </p>
                  </div>
                  <Switch
                    checked={automationSettings.includeManagersInRotation}
                    onCheckedChange={(checked) => {
                      setAutomationSettings((prev) => ({
                        ...prev,
                        includeManagersInRotation: checked,
                      }));
                      setAutomationDirty(true);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-4">
                  <div>
                    <p className="font-medium">Notifier le commercial affecté</p>
                    <p className="text-sm text-muted-foreground">
                      Envoie une notification instantanée lorsqu'un lead est attribué.
                    </p>
                  </div>
                  <Switch
                    checked={automationSettings.notifyAssignee}
                    onCheckedChange={(checked) => {
                      setAutomationSettings((prev) => ({ ...prev, notifyAssignee: checked }));
                      setAutomationDirty(true);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-4">
                  <div>
                    <p className="font-medium">Notifier le manager en cas de refus</p>
                    <p className="text-sm text-muted-foreground">
                      Alerte le manager si un lead est réassigné ou ignoré.
                    </p>
                  </div>
                  <Switch
                    checked={automationSettings.notifyManagerOnSkip}
                    onCheckedChange={(checked) => {
                      setAutomationSettings((prev) => ({ ...prev, notifyManagerOnSkip: checked }));
                      setAutomationDirty(true);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border p-4">
                  <div>
                    <p className="font-medium">Détection automatique des doublons</p>
                    <p className="text-sm text-muted-foreground">
                      Analyse les contacts récents pour éviter les doublons dans la fenêtre choisie.
                    </p>
                  </div>
                  <Switch
                    checked={automationSettings.duplicateDetectionEnabled}
                    onCheckedChange={(checked) => {
                      setAutomationSettings((prev) => ({
                        ...prev,
                        duplicateDetectionEnabled: checked,
                      }));
                      setAutomationDirty(true);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleResetAutomation} disabled={!automationDirty}>
                <RefreshCw className="mr-2 h-4 w-4" /> Réinitialiser
              </Button>
              <Button onClick={handleSaveAutomation} disabled={!automationDirty}>
                <Save className="mr-2 h-4 w-4" /> Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
