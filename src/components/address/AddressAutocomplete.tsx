import { useState, useEffect } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Address {
  properties: {
    label: string;
    city: string;
    postcode: string;
    name: string;
  };
}

interface AddressChangeOptions {
  manual?: boolean;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (
    address: string,
    city: string,
    postalCode: string,
    options?: AddressChangeOptions
  ) => void;
  disabled?: boolean;
}

export function AddressAutocomplete({ value, onChange, disabled }: AddressAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value || "");
  const [suggestions, setSuggestions] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  useEffect(() => {
    if (!search || search.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Ajouter "974" à la recherche pour filtrer La Réunion
        const searchQuery = `${search} 974`;
        const response = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(searchQuery)}&limit=10`
        );
        const data = await response.json();
        // Filtrer uniquement les résultats de La Réunion (codes postaux commençant par 974)
        const reunionResults = (data.features || []).filter((feature: Address) => 
          feature.properties.postcode?.startsWith('974')
        );
        setSuggestions(reunionResults);
      } catch (error) {
        console.error("Erreur lors de la recherche d'adresse:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSelect = (address: Address) => {
    const fullAddress = address.properties.label;
    const city = address.properties.city;
    const postalCode = address.properties.postcode;

    setSearch(fullAddress);
    onChange(fullAddress, city, postalCode, { manual: false });
    setOpen(false);
  };

  const handleManualSelect = () => {
    const trimmedSearch = search.trim();
    if (!trimmedSearch) {
      return;
    }

    setSearch(trimmedSearch);
    onChange(trimmedSearch, "", "", { manual: true });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Rechercher une adresse..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Tapez une adresse..." 
            value={search}
            onValueChange={setSearch}
          />
          <CommandEmpty>
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : search.trim().length < 3 ? (
              "Tapez au moins 3 caractères"
            ) : (
              "Aucune adresse trouvée"
            )}
          </CommandEmpty>
          {suggestions.length > 0 && (
            <CommandGroup>
              {suggestions.map((address, index) => (
                <CommandItem
                  key={index}
                  value={address.properties.label}
                  onSelect={() => handleSelect(address)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === address.properties.label ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{address.properties.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {address.properties.postcode} {address.properties.city}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {search.trim().length >= 3 && (
            <div className="border-t border-border p-2">
              <Button 
                size="sm" 
                variant="secondary" 
                className="w-full justify-start text-left"
                onClick={handleManualSelect}
              >
                Utiliser cette adresse : <span className="ml-1 font-medium truncate">{search}</span>
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
