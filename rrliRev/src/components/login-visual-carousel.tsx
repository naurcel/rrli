"use client";

import { useCallback, useEffect, useState } from "react";

const LOGIN_SLIDES = [
  {
    id: "fleet-team",
    src: "/branding/login-slides/rrli-fleet-team.jpg",
    alt: "Redeemed Route Logistics Inc. fleet trucks and dedicated operations crew",
    className: "login-slide-fleet-team",
    objectPosition: "59% center",
  },
  {
    id: "team-anniversary",
    src: "/branding/login-slides/rrli-team-anniversary.jpg",
    alt: "Redeemed Route Logistics Inc. 2nd Year Anniversary team celebration",
    className: "login-slide-team-anniversary",
    objectPosition: "center",
  },
] as const;

export function LoginVisualCarousel() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [hoverSide, setHoverSide] = useState<"left" | "right" | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const goToPrevSlide = useCallback(() => {
    setActiveSlide((prev) => (prev === 0 ? LOGIN_SLIDES.length - 1 : prev - 1));
  }, []);

  const goToNextSlide = useCallback(() => {
    setActiveSlide((prev) => (prev === LOGIN_SLIDES.length - 1 ? 0 : prev + 1));
  }, []);

  // Continuous auto-play motion loop (advances slides like an animated loop, pauses on hover)
  useEffect(() => {
    if (isHovered || hoverSide !== null) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev === LOGIN_SLIDES.length - 1 ? 0 : prev + 1));
    }, 4500);
    return () => clearInterval(interval);
  }, [isHovered, hoverSide]);

  // Keyboard navigation when user is on the page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoverSide(null);
      }}
    >
      {/* 1. Stacked Slide Images with Smooth Cross-Fade & Gentle Scale */}
      {LOGIN_SLIDES.map((slide, index) => (
        <img
          key={slide.id}
          src={slide.src}
          alt={slide.alt}
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
          aria-hidden={index !== activeSlide}
          className={`login-visual-media ${slide.className} ${index === activeSlide ? "is-active" : "is-inactive"}`}
          style={{ objectPosition: slide.objectPosition }}
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

      {/* 4. Top Indicator Dots showing slide progression (visible on hover) */}
      <div
        className={`login-carousel-indicators ${isHovered || hoverSide !== null ? "visible" : ""}`}
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
