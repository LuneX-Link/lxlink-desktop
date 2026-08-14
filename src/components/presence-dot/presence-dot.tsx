import cn from "classnames"
import type { PresenceStatus } from "../../hooks/usePresence"
import "./presence-dot.scss"

interface PresenceDotProps {
  status?: PresenceStatus | "inactive"
  className?: string
  label?: string
}

const normalizeStatus = (status: PresenceDotProps["status"]): PresenceStatus => {
  if (status === "online" || status === "idle" || status === "dnd" || status === "invisible") return status
  return "offline"
}

export const PresenceDot: React.FC<PresenceDotProps> = ({ status = "offline", className, label }) => {
  const normalizedStatus = normalizeStatus(status)

  return (
    <span
      className={cn("presence-dot", `presence-dot--${normalizedStatus}`, className)}
      aria-label={label ?? normalizedStatus}
      title={label ?? normalizedStatus}
    />
  )
}
