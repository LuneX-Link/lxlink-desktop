import { useCallback, useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";

import "./toast.scss";
import cn from "classnames";

export interface ToastProps {
  visible: boolean;
  title: string;
  message?: string;
  type: "success" | "error" | "warning";
  duration?: number;
  onClose: () => void;
}

export function Toast({
  visible,
  title,
  message,
  type,
  duration = 5000,
  onClose,
}: Readonly<ToastProps>) {
  const [isClosing, setIsClosing] = useState(false);
  const [progress, setProgress] = useState(100);

  const startAnimateClosing = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 150);
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      const startTime = Date.now();
      setProgress(100);

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
        setProgress(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
          startAnimateClosing();
        }
      }, 50);

      return () => {
        clearInterval(interval);
        setProgress(100);
        setIsClosing(false);
      };
    }
    return () => {};
  }, [startAnimateClosing, duration, visible]);

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle size={14} />;
      case "error":
        return <XCircle size={14} />;
      case "warning":
        return <AlertTriangle size={14} />;
      default:
        return <CheckCircle size={14} />;
    }
  };

  if (!visible) return null;

  return (
    <div
      className={cn("toast", {
        "toast--closing": isClosing,
        "toast--success": type === "success",
        "toast--error": type === "error",
        "toast--warning": type === "warning",
      })}
    >
      <div className="toast__accent" />

      <div className="toast__content">
        <div className="toast__icon">
          {getIcon()}
        </div>

        <div className="toast__text">
          <span className="toast__title">{title}</span>
          {message && <span className="toast__message">{message}</span>}
        </div>

        <button
          type="button"
          className="toast__close"
          onClick={startAnimateClosing}
          aria-label="Close"
        >
          <X size={13} />
        </button>
      </div>

      <div className="toast__progress">
        <div
          className="toast__progress-bar"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
