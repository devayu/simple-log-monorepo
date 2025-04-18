import { DashboardContent } from "@/components/dashboard/Dashboard";
import { ProjectNotFound } from "@/components/dashboard/ProjectNotFound";
import { Project } from "@/hooks/useProjects";
import { Api } from "@/services/api";

export default async function Home({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { data: project, error } = await Api.getInstance().fetch<Project>(
    `/getProject/${projectId}`,
    {
      cache: "no-store",
    }
  );

  if (error || !project) {
    return <ProjectNotFound />;
  }
  return <DashboardContent project={project}></DashboardContent>;
}
