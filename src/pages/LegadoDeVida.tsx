import { useState, useCallback, useRef, useMemo, forwardRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, BookOpen, X, Play, Pause, Volume2 } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import HTMLFlipBook from "react-pageflip";
import { Button } from "@/components/ui/button";
import LeftSidebar from "@/components/scenarios/LeftSidebar";
import MobileNavigation from "@/components/MobileNavigation";
import TipBanner from "@/components/TipBanner";
import LegadoClippy from "@/components/LegadoClippy";
import legadoPdf from "@/assets/legado-vida.pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const PageWrapper = forwardRef<HTMLDivElement, { pageNumber: number; width: number }>(
  ({ pageNumber, width }, ref) => (
    <div ref={ref} className="bg-white">
      <Page
        pageNumber={pageNumber}
        width={width}
        renderTextLayer={false}
        renderAnnotationLayer={false}
      />
    </div>
  )
);
PageWrapper.displayName = "PageWrapper";

const LegadoDeVida = () => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [opened, setOpened] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [headerVisible, setHeaderVisible] = useState(true);
  const bookRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const headerTexts = [
    { title: "El Legado de Vida", subtitle: "Documento oficial del Legado de Vida" },
    { title: "Practica cómo entregar", subtitle: "el Legado de Vida" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setHeaderVisible(false);
      setTimeout(() => {
        setHeaderIndex((prev) => (prev + 1) % headerTexts.length);
        setHeaderVisible(true);
      }, 600);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const maxSpread = Math.min(900, window.innerWidth - 100);
  const pageWidth = Math.round(maxSpread / 2);
  const pageHeight = Math.round(pageWidth * 1.414);

  // Cache the PDF file reference so react-pdf doesn't re-fetch on re-renders
  const pdfFile = useMemo(() => ({ url: legadoPdf, cMapPacked: true }), []);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const onFlip = useCallback((e: any) => {
    setCurrentPage(e.data + 1);
    // Stop current audio when flipping
    stopAudio();
  }, []);

  const openBook = () => {
    if (!opened && !transitioning) {
      setTransitioning(true);
      setTimeout(() => {
        setOpened(true);
        setTransitioning(false);
      }, 700);
    }
  };

  const closeBook = () => {
    stopAudio();
    setOpened(false);
    setCurrentPage(1);
  };

  const goToPrevious = () => bookRef.current?.pageFlip()?.flipPrev();
  const goToNext = () => bookRef.current?.pageFlip()?.flipNext();

  // Audio: files expected at /audio/legado/page-1.mp3, page-2.mp3, etc.
  const getAudioUrl = (page: number) => `/audio/legado/page-${page}.mp3`;

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  const toggleAudio = () => {
    if (isPlaying) {
      stopAudio();
      return;
    }

    const audio = new Audio(getAudioUrl(currentPage));
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    audio.play();
    audioRef.current = audio;
    setIsPlaying(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <LeftSidebar />

      <main className="lg:ml-60 min-h-screen flex flex-col animate-fade-in">
        {/* Header */}
        <div className="px-4 py-8">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <div
              className="transition-all duration-500 ease-in-out"
              style={{
                opacity: headerVisible ? 1 : 0,
                transform: headerVisible ? "translateY(0)" : "translateY(8px)",
              }}
            >
              <div className="flex items-center justify-center gap-3 mb-2">
                <BookOpen className="w-8 h-8 text-primary" />
                <h1
                  className="text-3xl font-bold text-foreground"
                  style={{ fontFamily: "'Nunito', 'DIN Rounded', -apple-system, sans-serif" }}
                >
                  {headerTexts[headerIndex].title}
                </h1>
              </div>
              <p className="text-muted-foreground">
                {headerTexts[headerIndex].subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* PDF Book Viewer */}
        <div className="flex-1 flex flex-col items-center px-4 pb-24">
          {/* Controls - only show after book opens */}
          <div
            className="flex items-center gap-3 mb-6 transition-opacity duration-500"
            style={{ opacity: opened ? 1 : 0, pointerEvents: opened ? "auto" : "none" }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={closeBook}
              className="rounded-xl gap-2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
              Cerrar libro
            </Button>

            <div className="w-px h-6 bg-border" />

            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevious}
              disabled={currentPage <= 1}
              className="rounded-xl gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>

            <span className="text-sm font-semibold text-muted-foreground min-w-[80px] text-center">
              {currentPage} / {numPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
              disabled={currentPage >= numPages}
              className="rounded-xl gap-2"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </Button>

            <div className="w-px h-6 bg-border" />

            {/* Audio button */}
            <Button
              variant={isPlaying ? "default" : "outline"}
              size="sm"
              onClick={toggleAudio}
              className={`rounded-xl gap-2 ${isPlaying ? "animate-pulse" : ""}`}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pausar
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  Escuchar
                </>
              )}
            </Button>
          </div>

          {/* Tip banner above book */}
          {opened && <TipBanner currentPage={currentPage} />}

          <Document
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div
                className="flex items-center justify-center rounded-xl border border-border bg-white shadow-lg"
                style={{ width: pageWidth, height: pageHeight }}
              >
                <p className="text-muted-foreground">Cargando documento...</p>
              </div>
            }
          >
            {/* Closed cover state */}
            {!opened && numPages > 0 && (
              <div className="flex flex-col items-center">
                <p className="text-sm text-muted-foreground mb-4 animate-pulse">
                  Haz click en la portada para abrir el libro
                </p>
                <div
                  onClick={openBook}
                  className="rounded-xl overflow-hidden shadow-2xl cursor-pointer transition-transform duration-700 origin-left"
                  style={{
                    width: pageWidth,
                    height: pageHeight,
                    transform: transitioning
                      ? "perspective(1200px) rotateY(-80deg) scale(0.9)"
                      : "perspective(1200px) rotateY(0deg)",
                    opacity: transitioning ? 0 : 1,
                    transition: "transform 700ms ease-in-out, opacity 600ms ease-in-out 400ms",
                  }}
                >
                  <Page
                    pageNumber={1}
                    width={pageWidth}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </div>
              </div>
            )}

            {/* Opened book state */}
            {opened && numPages > 0 && (
              <div className="shadow-2xl rounded-xl overflow-hidden animate-in fade-in duration-500">
                {/* @ts-ignore - react-pageflip types */}
                <HTMLFlipBook
                  ref={bookRef}
                  width={pageWidth}
                  height={pageHeight}
                  showCover={true}
                  onFlip={onFlip}
                  flippingTime={800}
                  useMouseEvents={true}
                  swipeDistance={30}
                  maxShadowOpacity={0.5}
                  mobileScrollSupport={false}
                  className=""
                  style={{}}
                  startPage={1}
                  size="fixed"
                  minWidth={250}
                  maxWidth={500}
                  minHeight={350}
                  maxHeight={710}
                  drawShadow={true}
                  usePortrait={false}
                  startZIndex={0}
                  autoSize={false}
                  clickEventForward={false}
                  showPageCorners={true}
                  disableFlipByClick={false}
                >
                  {Array.from({ length: numPages }, (_, i) => (
                    <PageWrapper key={i} pageNumber={i + 1} width={pageWidth} />
                  ))}
                </HTMLFlipBook>
              </div>
            )}
          </Document>
        </div>
      </main>

      <LegadoClippy currentPage={currentPage} visible={opened} />
      <MobileNavigation />
    </div>
  );
};

export default LegadoDeVida;
