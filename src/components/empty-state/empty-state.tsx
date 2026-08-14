import { useTranslation } from "react-i18next"
import "./empty-state.scss"
import { AnnoyedIcon } from "../icons"

export function EmptyState() {
  const { t } = useTranslation("empty_states")

  return (
    <div className="empty-state">
      <div className="empty-state__empty">
        <div className="empty-state__empty-icon-wrap">
          <AnnoyedIcon size={32} />
        </div>
        <p className="empty-state__empty-title">{t("home_title")}</p>
        <p className="empty-state__empty-subtitle">{t("home_quip")}</p>
      </div>
    </div>
  )
}
