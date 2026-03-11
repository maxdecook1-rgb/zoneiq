import Link from 'next/link'
import { Project } from '@/lib/types'
import ConfidenceBadge from './ConfidenceBadge'

interface ProjectCardProps {
  project: Project
}

const statusStyles = {
  permitted: { bg: 'bg-green-100', text: 'text-green-800', label: 'Permitted' },
  conditional: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Conditional' },
  not_permitted: { bg: 'bg-red-100', text: 'text-red-800', label: 'Not Permitted' },
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const status = project.result?.status || 'not_permitted'
  const style = statusStyles[status]
  const date = new Date(project.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <Link href={`/project/${project.id}`}>
      <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-gray-300
                      transition-all duration-200 cursor-pointer h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
            {style.label}
          </span>
          {project.result?.confidence && (
            <ConfidenceBadge confidence={project.result.confidence} />
          )}
        </div>

        <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">
          {project.address || 'Unknown Address'}
        </h3>

        <p className="text-sm text-gray-500 mb-3 capitalize">
          {project.project_inputs?.type?.replace('_', ' ') || 'Unknown Type'}
          {project.project_inputs?.units ? ` \u2022 ${project.project_inputs.units} units` : ''}
        </p>

        <div className="mt-auto pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">{date}</p>
        </div>
      </div>
    </Link>
  )
}
