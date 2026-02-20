import { useState, useCallback, useRef } from 'react'

export const useToast = () => {
  const [toast, setToast] = useState({ visible: false, message: '', type: 'default' })
  const timerRef = useRef(null)

  const showToast = useCallback((message, type = 'default') => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ visible: true, message, type })
    timerRef.current = setTimeout(() => {
      setToast(t => ({ ...t, visible: false }))
    }, 4000)
  }, [])

  return { toast, showToast }
}
