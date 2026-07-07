import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListHistory,
  useDeleteHistoryRecord,
  useBulkDeleteHistory,
  getListHistoryQueryKey,
  getGetStatsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatProductionDate } from "@/lib/format";

export function HistoryTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: history = [], isLoading } = useListHistory();
  const deleteMutation = useDeleteHistoryRecord();
  const bulkDeleteMutation = useBulkDeleteHistory();

  const [selected, setSelected] = useState<Set<number>>(new Set());

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListHistoryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
  };

  const allIds = history.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownload = (url: string) => {
    const finalUrl = url.startsWith("/api") ? url : `/api${url}`;
    window.open(finalUrl, "_blank");
  };

  const handleDeleteOne = (id: number) => {
    if (!window.confirm("Excluir este registro do histórico?")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Excluído", description: "Registro removido do histórico." });
          setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
          invalidate();
        },
        onError: () => toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" }),
      }
    );
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Excluir ${ids.length} registro(s) selecionado(s)?`)) return;
    bulkDeleteMutation.mutate(
      { data: { ids } },
      {
        onSuccess: (res) => {
          toast({ title: "Excluídos", description: `${res.deleted} registro(s) removido(s).` });
          setSelected(new Set());
          invalidate();
        },
        onError: () => toast({ title: "Erro", description: "Falha ao excluir registros.", variant: "destructive" }),
      }
    );
  };

  const isBusy = deleteMutation.isPending || bulkDeleteMutation.isPending;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Histórico de Emissões</CardTitle>
          <CardDescription>
            {history.length} registro(s) — Certificados gerados e disponíveis para download.
          </CardDescription>
        </div>
        {someSelected && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            disabled={isBusy}
            data-testid="button-bulk-delete"
          >
            {bulkDeleteMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Excluir selecionados ({selected.size})
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos"
                    disabled={history.length === 0 || isBusy}
                  />
                </TableHead>
                <TableHead>Data Emissão</TableHead>
                <TableHead>Cód. SAP</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Data Produção</TableHead>
                <TableHead>Nota Fiscal</TableHead>
                <TableHead className="text-right">Pallets</TableHead>
                <TableHead className="text-right">Peças</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    Nenhum certificado gerado até o momento.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((record) => (
                  <TableRow
                    key={record.id}
                    data-testid={`row-history-${record.id}`}
                    className={selected.has(record.id) ? "bg-muted/30" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(record.id)}
                        onCheckedChange={() => toggleOne(record.id)}
                        aria-label={`Selecionar registro ${record.id}`}
                        disabled={isBusy}
                      />
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(record.generatedAt)}</TableCell>
                    <TableCell className="font-mono font-medium text-xs">{record.sapCode}</TableCell>
                    <TableCell
                      className="text-xs truncate max-w-[130px]"
                      title={record.productName || ""}
                    >
                      {record.productName || "-"}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatProductionDate(record.productionDate)}</TableCell>
                    <TableCell className="font-medium text-xs">{record.invoiceNumber}</TableCell>
                    <TableCell className="text-right font-medium text-xs tabular-nums">{record.pallets}</TableCell>
                    <TableCell className="text-right font-medium text-xs tabular-nums">
                      {record.pieces.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(record.downloadUrl)}
                          className="h-8 text-xs"
                          data-testid={`button-download-${record.id}`}
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />
                          PDF
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteOne(record.id)}
                          disabled={isBusy}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          data-testid={`button-delete-history-${record.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
