import { LoaderCircle, Phone, PhoneOff, Video } from "lucide-react"

import { Button } from "../ui/button/button"
import { Modal } from "../ui/modal/modal"
import type { IncomingCall } from "../../types/calls"
import "./incoming-call-modal.scss"

interface IncomingCallModalProps {
  call: IncomingCall | null
  busy: boolean
  onAccept: () => void
  onDecline: () => void
}

export const IncomingCallModal = ({ call, busy, onAccept, onDecline }: IncomingCallModalProps) => (
  <Modal
    visible={Boolean(call)}
    title="Входящий звонок"
    description={call ? `Чат: ${call.channel_name}` : undefined}
    onClose={onDecline}
    clickOutsideToClose={false}
  >
    <div className="incoming-call">
      <div className="incoming-call__signal" aria-hidden="true">
        {call?.kind === "video" ? <Video size={30} /> : <Phone size={30} />}
      </div>
      <p className="incoming-call__status">
        {call?.kind === "video" ? "Видеозвонок" : "Голосовой звонок"}
      </p>
      <div className="incoming-call__actions">
        <Button theme="danger" onClick={onDecline} disabled={busy}>
          <PhoneOff size={17} />
          Отклонить
        </Button>
        <Button theme="primary" onClick={onAccept} disabled={busy}>
          {busy ? <LoaderCircle className="incoming-call__spinner" size={17} /> : <Phone size={17} />}
          Принять
        </Button>
      </div>
    </div>
  </Modal>
)
