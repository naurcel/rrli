"use client";

import { useCallback, useEffect, useState } from "react";

const LOGIN_SLIDES = [
  { id: 1, src: "/branding/login-slides/slide-1.jpg", alt: "RouteX logistics flow - Neon Aura" },
  { id: 2, src: "/branding/login-slides/slide-2.jpg", alt: "RouteX logistics flow - Frost Ether" },
  { id: 3, src: "/branding/login-slides/slide-3.jpg", alt: "RouteX logistics flow - Violet Silk" },
  { id: 4, src: "/branding/login-slides/slide-4.jpg", alt: "RouteX logistics flow - Cyber Wave" },
  { id: 5, src: "/branding/login-slides/slide-5.jpg", alt: "RouteX logistics flow - Aqua Ripple" },
  { id: 6, src: "/branding/login-slides/slide-6.jpg", alt: "RouteX logistics flow - Solar Beam" },
  { id: 7, src: "/branding/login-slides/slide-7.jpg", alt: "RouteX logistics flow - Crimson Grain" },
] as const;

export function LoginVisualCarousel() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [hoverSide, setHoverSide] = useState<"left" | "right" | null>(null);

  const goToPrevSlide = useCallback(() => {
    setActiveSlide((prev) => (prev === 0 ? LOGIN_SLIDES.length - 1 : prev - 1));
  }, []);

  const goToNextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev === LOGIN_SLIDES.length - 1 ? 0 : prev + 1));
  }, []);

  // Keyboard navigation when user is on the page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        goToPrevSlide();
      } else if (e.key === "ArrowRight") {
        goToNextSlide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrevSlide, goToNextSlide]);

  return (
    <section
      className="login-visual login-carousel-root"
      aria-label="RouteX logistics visual presentation"
      onMouseLeave={() => setHoverSide(null)}
    >
      {/* 1. Stacked Slide Images with Smooth Cross-Fade & Gentle Scale */}
      {LOGIN_SLIDES.map((slide, index) => (
        <img
          key={slide.id}
          src={slide.src}
          alt={slide.alt}
          aria-hidden={index !== activeSlide}
          className={`login-visual-media ${index === activeSlide ? "is-active" : "is-inactive"}`}
        />
      ))}

      {/* 2. Base Subtle Ambient Vignette Overlay for Text Legibility */}
      <div className="login-visual-overlay" />

      {/* 3. Dynamic Side Hover Shadow Overlays */}
      <div
        className={`login-carousel-shadow-overlay left ${hoverSide === "left" ? "visible" : ""}`}
        aria-hidden="true"
      />
      <div
        className={`login-carousel-shadow-overlay right ${hoverSide === "right" ? "visible" : ""}`}
        aria-hidden="true"
      />

      {/* 4. Top Indicator Dots showing how many images there are (appears when hovering left or right) */}
      <div
        className={`login-carousel-indicators ${hoverSide !== null ? "visible" : ""}`}
        role="tablist"
        aria-label="Slide indicators"
      >
        {LOGIN_SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            role="tab"
            aria-selected={index === activeSlide}
            aria-label={`Show slide ${index + 1} of ${LOGIN_SLIDES.length}`}
            className={`login-carousel-dot ${index === activeSlide ? "active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveSlide(index);
            }}
          />
        ))}
      </div>

      {/* 5. Left Hover Zone & Toggle Button */}
      <div
        className="login-carousel-zone left"
        onMouseEnter={() => setHoverSide("left")}
        onClick={goToPrevSlide}
        role="button"
        aria-label="Previous slide"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            goToPrevSlide();
          }
        }}
      >
        <div
          className={`login-carousel-toggle left ${hoverSide === "left" ? "visible" : ""}`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </div>
      </div>

      {/* 6. Right Hover Zone & Toggle Button */}
      <div
        className="login-carousel-zone right"
        onMouseEnter={() => setHoverSide("right")}
        onClick={goToNextSlide}
        role="button"
        aria-label="Next slide"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            goToNextSlide();
          }
        }}
      >
        <div
          className={`login-carousel-toggle right ${hoverSide === "right" ? "visible" : ""}`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      {/* 7. Bottom Brand Copy */}
      <div className="login-visual-copy">
        <h1>
          Excellence in motion,
          <br />
          your logistics redemption.
        </h1>
        <span>Redeemed Route Logistics Inc.</span>
      </div>
    </section>
  );
}
