import React from "react";
import { Link } from "wouter";
import { useListMasteringJobs, useDeleteMasteringJob, getListMasteringJobsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ExternalLink, Activity, ArrowRight, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate, PRESET_LABELS, STATUS_COLORS } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

export function HistoryPage() {
  const { data: jobs, isLoading } = useListMasteringJobs();
  const deleteJob = useDeleteMasteringJob();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm("Are you sure you want to delete this mastering job? The files will be removed permanently.")) {
      return;
    }

    try {
      await deleteJob.mutateAsync({ id });
      
      // Update cache optimistically
      queryClient.setQueryData(
        getListMasteringJobsQueryKey(),
        (old: { id: number }[] | undefined) => {
          if (!Array.isArray(old)) return old;
          return old.filter((job) => job.id !== id);
        }
      );
      
      toast({
        title: "Job deleted",
        description: "The mastering job and its files have been removed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the job.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container mx-auto p-4 py-8 md:py-12 max-w-5xl animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Session History</h1>
          <p className="text-muted-foreground mt-1">View and manage your past mastering jobs.</p>
        </div>
        <Button asChild variant="outline" className="border-primary/20 text-primary hover:bg-primary/10">
          <Link href="/">New Master</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="bg-card/40 border-border/40">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-10 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !jobs || jobs.length === 0 ? (
        <Card className="border-dashed border-2 bg-background/50 text-center py-16">
          <CardContent className="flex flex-col items-center justify-center p-0">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">No history found</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              You haven't mastered any tracks yet. Your session history will appear here.
            </p>
            <Button asChild>
              <Link href="/">Start First Session</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => {
            const isCompleted = job.status === "completed";
            
            return (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card className="bg-card/40 hover:bg-card hover:border-primary/30 transition-all cursor-pointer group overflow-hidden border-border/60">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row md:items-center">
                      <div className="p-5 flex-1 flex flex-col gap-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-lg font-mono truncate max-w-[200px] md:max-w-md" data-testid={`job-filename-${job.id}`}>
                              {job.originalFilename}
                            </h3>
                            <Badge variant="outline" className={`${STATUS_COLORS[job.status] || STATUS_COLORS.pending} border uppercase tracking-wider text-[10px] px-2`} data-testid={`job-status-${job.id}`}>
                              {job.status}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1 font-mono text-xs">
                            {formatDate(job.createdAt)}
                          </span>
                          <span>•</span>
                          <span className="text-primary/80 font-medium">
                            {PRESET_LABELS[job.preset]}
                          </span>
                          
                          {isCompleted && job.measuredInputLufs && job.measuredOutputLufs && (
                            <>
                              <span>•</span>
                              <div className="flex items-center gap-2 font-mono text-xs bg-background rounded px-2 py-0.5 border border-border">
                                <span className="opacity-70">{job.measuredInputLufs.toFixed(1)}</span>
                                <ArrowRight size={12} className="opacity-50" />
                                <span className="text-primary font-bold">{job.measuredOutputLufs.toFixed(1)} LUFS</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="border-t md:border-t-0 md:border-l border-border/50 p-4 md:p-6 bg-background/30 flex items-center justify-end gap-3 md:w-auto w-full group-hover:bg-primary/5 transition-colors">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleDelete(job.id, e)}
                          data-testid={`btn-delete-${job.id}`}
                          title="Delete job"
                        >
                          <Trash2 size={18} />
                        </Button>
                        <Button variant="secondary" size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors font-medium">
                          {isCompleted ? 'View Master' : 'View Status'} 
                          <ExternalLink size={14} className="ml-2" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}