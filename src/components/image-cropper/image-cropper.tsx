"use client"

import type React from "react"
import { useState, useCallback } from "react"
import Cropper from "react-easy-crop"
import { createPortal } from "react-dom"
import { Backdrop } from "../ui/backdrop/backdrop"
import { Button } from "../ui/button/button"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import "./image-cropper.scss"

interface ImageCropperProps {
  visible: boolean
  image: string
  aspect: number
  cropShape?: "round" | "rect"
  onApply: (croppedBlob: Blob) => void
  onCancel: () => void
}

interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

const getCroppedImg = (imageSrc: string, pixelCrop: PixelCrop): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = pixelCrop.width
      canvas.height = pixelCrop.height
      const ctx = canvas.getContext("2d")
      if (!ctx) return reject(new Error("No canvas context"))
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      )
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Failed to create blob"))
      }, "image/png")
    }
    image.onerror = () => reject(new Error("Failed to load image"))
    image.src = imageSrc
  })
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
  visible,
  image,
  aspect,
  cropShape = "round",
  onApply,
  onCancel,
}) => {
  const { t } = useTranslation("settings")
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null)

  const onCropComplete = useCallback((_: unknown, croppedAreaPixelsResult: PixelCrop) => {
    setCroppedAreaPixels(croppedAreaPixelsResult)
  }, [])

  const handleApply = useCallback(async () => {
    if (!croppedAreaPixels) return
    try {
      const blob = await getCroppedImg(image, croppedAreaPixels)
      onApply(blob)
    } catch (error) {
      console.error("Crop failed:", error)
    }
  }, [croppedAreaPixels, image, onApply])

  if (!visible) return null

  return createPortal(
    <Backdrop visible={visible}>
      <div className="image-cropper">
        <div className="image-cropper__header">
          <h3 className="image-cropper__title">{t("crop_image")}</h3>
          <button className="image-cropper__close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="image-cropper__body">
          <div className="image-cropper__crop-area">
            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div className="image-cropper__controls">
            <label className="image-cropper__zoom-label">
              {t("zoom")}
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="image-cropper__zoom-slider"
              />
            </label>
          </div>
        </div>

        <div className="image-cropper__footer">
          <Button theme="outline" onClick={onCancel}>{t("cancel")}</Button>
          <Button theme="primary" onClick={handleApply}>{t("apply")}</Button>
        </div>
      </div>
    </Backdrop>,
    document.body
  )
}
