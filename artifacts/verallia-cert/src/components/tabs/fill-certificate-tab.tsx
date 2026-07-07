import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSapCodes,
  useGetCertificatesBySap,
  getGetCertificatesBySapQueryKey,
  useListPalletQuantities,
  useFillCertificate,
  getGetStatsQueryKey,
  getListHistoryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { formatProductionDate } from "@/lib/format";
import { AlertCircle, FileOutput, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export function FillCertificateTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [sapCode, setSapCode] = useState<string>("");
  const [sapOpen, setSapOpen] = useState(false);
  const [certificateId, setCertificateId] = useState<string>("");
  const [invoice, setInvoice] = useState("");
  const [pallets, setPallets] = useState("");
  const [pieces, setPieces] = useState("");

  const { data: sapCodes = [] } = useListSapCodes();
  const { data: palletList = [] } = useListPalletQuantities();

  const { data: certificates = [], isLoading: isLoadingCerts } = useGetCertificatesBySap(sapCode, {
    query: { enabled: !!sapCode, queryKey: getGetCertificatesBySapQueryKey(sapCode) },
  });

  const fillMutation = useFillCertificate();

  const palletEntry = palletList.find((p) => p.sapCode === sapCode);
  const piecesPerPallet = palletEntry?.piecesPerPallet ?? null;

  const selectedSapLabel = sapCodes.find((s) => s.sapCode === sapCode);

  const handleSapChange = (val: string) => {
    setSapCode(val);
    setSapOpen(false);
    setCertificateId("");
    setPallets("");
    setPieces("");
  };

  useEffect(() => {
    if (pallets && piecesPerPallet !== null && !isNaN(Number(pallets))) {
      const p = Number(pallets);
      if (p >= 0) setPieces(String(p * piecesPerPallet));
    }
  }, [pallets, piecesPerPallet]);

  const handleGenerate = () => {
    if (!certificateId || !invoice || !pallets || !pieces) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione certificado, preencha Nota Fiscal, Pallets e Peças.",
        variant: "destructive",
      });
      return;
    }

    fillMutation.mutate(
      {
        data: {
          certificateId: Number(certificateId),
          invoiceNumber: invoice,
          pallets: Number(pallets),
          pieces: Number(pieces),
        },
      },
      {
        onSuccess: (data) => {
          toast({ title: "Certificado Gerado", description: "O download iniciará em instantes." });
          window.open(data.downloadUrl, "_blank");
          setCertificateId("");
          setInvoice("");
          setPallets("");
          setPieces("");
          queryClient.invalidateQueries({ queryKey: getListHistoryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        },
        onError: (err) => {
          const msg = (err as { data?: { error?: string } }).data?.error ?? "Não foi possível gerar o certificado.";
          toast({ title: "Erro", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Preencher Certificado</CardTitle>
        <CardDescription>
          Selecione o código SAP e data de produção, preencha a Nota Fiscal e pallets para gerar o PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SAP Code — searchable combobox */}
          <div className="space-y-2">
            <Label>Código SAP</Label>
            <Popover open={sapOpen} onOpenChange={setSapOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={sapOpen}
                  data-testid="select-sap-code"
                  className="w-full justify-between font-normal truncate"
                >
                  <span className="truncate">
                    {sapCode
                      ? selectedSapLabel
                        ? `${sapCode}${selectedSapLabel.productName ? ` — ${selectedSapLabel.productName}` : ""}`
                        : sapCode
                      : sapCodes.length === 0
                        ? "Nenhum certificado carregado"
                        : "Digite ou selecione o SAP..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar código SAP..." />
                  <CommandList>
                    <CommandEmpty>Nenhum código encontrado.</CommandEmpty>
                    <CommandGroup>
                      {sapCodes.map((s) => (
                        <CommandItem
                          key={s.sapCode}
                          value={`${s.sapCode} ${s.productName ?? ""}`}
                          onSelect={() => handleSapChange(s.sapCode)}
                          data-testid={`option-sap-${s.sapCode}`}
                        >
                          <Check
                            className={cn("mr-2 h-4 w-4 shrink-0", sapCode === s.sapCode ? "opacity-100" : "opacity-0")}
                          />
                          <span className="font-mono mr-2">{s.sapCode}</span>
                          {s.productName && (
                            <span className="text-muted-foreground text-xs truncate">{s.productName}</span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Production date — only shows dates for selected SAP */}
          <div className="space-y-2">
            <Label>Data de Produção</Label>
            <Select
              value={certificateId}
              onValueChange={setCertificateId}
              disabled={!sapCode || isLoadingCerts}
            >
              <SelectTrigger data-testid="select-production-date">
                <SelectValue
                  placeholder={
                    !sapCode
                      ? "Selecione um SAP primeiro"
                      : isLoadingCerts
                        ? "Carregando..."
                        : certificates.length === 0
                          ? "Nenhuma data disponível"
                          : "Selecione a data..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {certificates.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {formatProductionDate(c.productionDate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sapCode && !isLoadingCerts && certificates.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {certificates.length} data(s) disponível(is) para este SAP.
              </p>
            )}
          </div>
        </div>

        {sapCode && !palletEntry && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription>
              SAP <span className="font-mono font-bold">{sapCode}</span> não possui base de pallets cadastrada. O
              cálculo de peças não será automático. Adicione na aba "Base Peças/Pallet".
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label>Nota Fiscal (NF)</Label>
          <Input
            data-testid="input-invoice"
            value={invoice}
            onChange={(e) => setInvoice(e.target.value)}
            placeholder="Ex: 123456"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg border">
          <div className="space-y-2">
            <Label>Quantidade de Pallets</Label>
            <Input
              data-testid="input-pallets"
              type="number"
              min="0"
              value={pallets}
              onChange={(e) => setPallets(e.target.value)}
              placeholder="0"
            />
            {piecesPerPallet !== null && (
              <p className="text-xs text-muted-foreground">
                Base: {piecesPerPallet.toLocaleString("pt-BR")} peças/pallet
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Total de Peças</Label>
            <Input
              data-testid="input-pieces"
              type="number"
              min="0"
              value={pieces}
              onChange={(e) => setPieces(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">Calculado automaticamente ou edite manualmente.</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end border-t p-6 bg-muted/10">
        <Button
          data-testid="button-generate-pdf"
          size="lg"
          onClick={handleGenerate}
          disabled={!certificateId || fillMutation.isPending}
          className="w-full md:w-auto"
        >
          {fillMutation.isPending ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <FileOutput className="w-5 h-5 mr-2" />
          )}
          Gerar PDF e Baixar
        </Button>
      </CardFooter>
    </Card>
  );
}
