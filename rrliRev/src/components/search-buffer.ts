"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SearchBufferOptions {
  delay?: number;
  initialValue?: string;
  onSearch?: (query: string) => void;
}

export function useSearchBuffer({
  delay = 150,
  initialValue = "",
  onSearch,
}: SearchBufferOptions = {}) {
  const effectiveDelay = Math.min(Math.max(delay, 30), 150);
  const [value, setValue] = useState(initialValue);
  const [bufferedQuery, setBufferedQuery] = useState(initialValue);
  const [isBuffering, setIsBuffering] = useState(false);
  const onSearchRef = useRef(onSearch);

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    if (value === bufferedQuery) {
      setIsBuffering(false);
      return;
    }

    setIsBuffering(true);
    const handler = setTimeout(() => {
      setBufferedQuery(value);
      setIsBuffering(false);
      onSearchRef.current?.(value);
    }, effectiveDelay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, bufferedQuery, effectiveDelay]);

  const clear = useCallback(() => {
    setValue("");
    setBufferedQuery("");
    setIsBuffering(false);
    onSearchRef.current?.("");
  }, []);

  const reset = useCallback((newValue: string) => {
    setValue(newValue);
    setBufferedQuery(newValue);
    setIsBuffering(false);
  }, []);

  return {
    value,
    setValue,
    bufferedQuery,
    isBuffering,
    clear,
    reset,
  };
}
