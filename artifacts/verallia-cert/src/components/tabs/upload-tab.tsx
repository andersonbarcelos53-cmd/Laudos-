import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCertificates,
  useDeleteCertificate,
  useBulkDeleteCertificates,
  getListCertificatesQueryKey,
  getListSapCodesQueryKey,
  getGetStatsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UploadCloud, Trash2, File as FileIcon, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatProductionDate } from "@/lib/format";

type UploadResult =
  | { ok: true; fileName: string; sapCode: string; productionDate: string }
  | { ok: false; fileName: string; error: string };

export function UploadTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: certificates = [], isLoading: isLoadingList } = useListCertificates();
  const deleteMutation = useDeleteCertificate();
  const bulkDeleteMutation = useBulkDeleteCertificates();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListCertificatesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListSapCodesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
  };

  const allIds = certificates.map((c) => c.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;
  const isBusy = deleteMutation.isPending || bulkDeleteMutation.isPending;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const handleFiles = async (files: File[]) => {
    const pdfFiles = files.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length === 0) {
      toast({ title: "Erro", description: "Apenas arquivos PDF são permitidos.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadResults([]);

    try {
      const formData = new FormData();
      pdfFiles.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/certificates/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        toast({ title: "Erro no upload", description: data.error ?? "Erro desconhecido", variant: "destructive" });
        return;
      }

      const results: UploadResult[] = (data as Array<Record<string, unknown>>).map((item) => {
        if (item.error) {
          return { ok: false, fileName: String(item.fileName ?? ""), error: String(item.error) };
        }
        return {
          ok: true,
          fileName: String(item.fileName ?? ""),
          sapCode: String(item.sapCode ?? ""),
          productionDate: String(item.productionDate ?? ""),
        };
      });

      setUploadResults(results);

      const successes = results.filter((r) => r.ok).length;
      const failures = results.filter((r) => !r.ok).length;

      if (successes > 0) {
        toast({
          title: "Upload concluído",
          description: `${successes} certificado(s) registrado(s)${failures > 0 ? `, ${failures} com erro` : ""}.`,
        });
        invalidate();
      } else {
        toast({
          title: "Nenhum certificado registrado",
          description: "Verifique os erros abaixo.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Erro de conexão", description: "Não foi possível enviar os arquivos.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteOne = (id: number) => {
    if (!window.confirm("Deseja realmente excluir este certificado?")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Excluído", description: "Certificado removido." });
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
    if (!window.confirm(`Excluir ${ids.length} certificado(s) selecionado(s)? Esta ação não pode ser desfeita.`)) return;
    bulkDeleteMutation.mutate(
      { data: { ids } },
      {
        onSuccess: (res) => {
          toast({ title: "Excluídos", description: `${res.deleted} certificado(s) removido(s).` });
          setSelected(new Set());
          invalidate();
        },
        onError: () => toast({ title: "Erro", description: "Falha ao excluir certificados.", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload de Certificados</CardTitle>
          <CardDescription>Arraste e solte arquivos PDF ou clique para selecionar. O sistema extrai SAP e data automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            data-testid="upload-dropzone"
            className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer
              ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"}
              ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && document.getElementById("file-upload")?.click()}
          >
            <input
              id="file-upload"
              type="file"
              multiple
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileInput}
            />
            {isUploading ? (
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="w-10 h-10 mb-4 animate-spin text-primary" />
                <p className="text-sm font-medium">Processando PDFs...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <UploadCloud className="w-8 h-8 text-primary" />
                </div>
                <p className="text-sm font-medium">Arraste os arquivos PDF aqui ou clique para buscar</p>
                <p className="text-xs mt-1">O sistema extrairá o código SAP e data automaticamente.</p>
              </div>
            )}
          </div>

          {uploadResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Resultado do último upload:</p>
              {uploadResults.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-sm px-3 py-2 rounded-md border ${
                    r.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  {r.ok ? (
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  )}
                  <span>
                    <span className="font-medium">{r.fileName}</span>
                    {r.ok
                      ? ` — SAP: ${r.sapCode}, Data: ${r.productionDate}`
                      : ` — ${r.error}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Certificados Carregados</CardTitle>
            <CardDescription>Total: {certificates.length} arquivo(s) disponível(is) para preenchimento.</CardDescription>
          </div>
          {someSelected && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isBusy}
              data-testid="button-bulk-delete-certificates"
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
                      disabled={certificates.length === 0 || isBusy}
                    />
                  </TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Cód. SAP</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Data Produção</TableHead>
                  <TableHead>Data Upload</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingList ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : certificates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nenhum certificado encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  certificates.map((cert) => (
                    <TableRow
                      key={cert.id}
                      data-testid={`row-certificate-${cert.id}`}
                      className={selected.has(cert.id) ? "bg-muted/30" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(cert.id)}
                          onCheckedChange={() => toggleOne(cert.id)}
                          aria-label={`Selecionar certificado ${cert.id}`}
                          disabled={isBusy}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[180px] text-xs" title={cert.fileName}>
                            {cert.fileName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{cert.sapCode}</TableCell>
                      <TableCell className="text-xs truncate max-w-[120px]" title={cert.productName || ""}>
                        {cert.productName || "-"}
                      </TableCell>
                      <TableCell className="text-xs">{formatProductionDate(cert.productionDate)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(cert.uploadedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          data-testid={`button-delete-certificate-${cert.id}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteOne(cert.id)}
                          disabled={isBusy}
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
