import { forwardRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import certificateBadge from "@/assets/certificate-badge.png";

interface CertificatePreviewProps {
  studentName: string;
  grade: number;
  // Nivel del certificado: 1 = Prospección, 2 = Objeciones (final). Cambia el
  // título y el nombre de curso por defecto.
  level?: 1 | 2;
  // Datos configurables por el admin (AppConfig). Vacíos = comportamiento
  // anterior: nombre de curso por defecto y líneas de firma sin nombre.
  instructorName?: string | null;
  directorName?: string | null;
  courseName?: string | null;
  // Firma manuscrita (imagen, data URI). Vacío = sólo la línea, como antes.
  instructorSignature?: string | null;
  directorSignature?: string | null;
}

const CertificatePreview = forwardRef<HTMLDivElement, CertificatePreviewProps>(
  (
    {
      studentName,
      grade,
      level = 2,
      instructorName,
      directorName,
      courseName,
      instructorSignature,
      directorSignature,
    },
    ref,
  ) => {
    const currentDate = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
    const defaultCourseName = level === 1 ? "Prospección" : "Manejo de Objeciones";

    return (
      <div
        ref={ref}
        className="bg-white w-[800px] min-h-[566px] p-12 relative overflow-hidden"
        style={{
          fontFamily: "'Georgia', serif",
        }}
      >
        {/* Border decoration */}
        <div className="absolute inset-4 border-4 border-amber-600 rounded-lg pointer-events-none" />
        <div className="absolute inset-6 border-2 border-amber-400 rounded-lg pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-between h-full min-h-[490px] py-4">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-amber-800 tracking-wide uppercase mb-1">
              Certificado de Logro
            </h1>
            <p className="text-amber-700 text-sm font-semibold tracking-widest uppercase mb-1">
              Nivel {level}
            </p>
            <p className="text-amber-600 text-sm tracking-widest uppercase">
              Centro de Negocios Señoriales
            </p>
          </div>

          {/* Badge */}
          <div className="my-4">
            <img
              src={certificateBadge}
              alt="Badge del curso"
              className="w-28 h-28 object-contain"
              crossOrigin="anonymous"
            />
          </div>

          {/* Main Content */}
          <div className="text-center max-w-lg">
            <p className="text-gray-600 text-base mb-4">
              Se certifica que
            </p>
            <h2 className="text-3xl font-bold text-gray-800 mb-4 border-b-2 border-amber-400 pb-2 px-8 inline-block">
              {studentName}
            </h2>
            <p className="text-gray-600 text-base mb-4">
              ha completado satisfactoriamente el curso de
            </p>
            <h3 className="text-2xl font-bold text-amber-700 mb-4">
              {courseName?.trim() || defaultCourseName}
            </h3>
            <p className="text-gray-600 text-base">
              Técnica y Persuasión
            </p>
          </div>

          {/* Grade */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg px-8 py-3 my-4">
            <p className="text-amber-800 text-lg">
              Calificación Final: <span className="font-bold text-2xl">{grade}</span>/100
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-end w-full px-8">
            <div className="text-center">
              {instructorSignature && (
                <img
                  src={instructorSignature}
                  alt="Firma del instructor"
                  className="mx-auto max-h-12 object-contain mb-0.5"
                  crossOrigin="anonymous"
                />
              )}
              {instructorName?.trim() && (
                <p className="text-gray-800 text-sm font-semibold mb-0.5">{instructorName.trim()}</p>
              )}
              <div className="w-40 border-t-2 border-gray-400 mb-1" />
              <p className="text-gray-600 text-sm">Instructor</p>
            </div>
            <div className="text-center text-gray-500 text-sm">
              <p>{currentDate}</p>
            </div>
            <div className="text-center">
              {directorSignature && (
                <img
                  src={directorSignature}
                  alt="Firma del director académico"
                  className="mx-auto max-h-12 object-contain mb-0.5"
                  crossOrigin="anonymous"
                />
              )}
              {directorName?.trim() && (
                <p className="text-gray-800 text-sm font-semibold mb-0.5">{directorName.trim()}</p>
              )}
              <div className="w-40 border-t-2 border-gray-400 mb-1" />
              <p className="text-gray-600 text-sm">Director Académico</p>
            </div>
          </div>
        </div>

        {/* Watermark pattern */}
        <div 
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `url(${certificateBadge})`,
            backgroundSize: "100px",
            backgroundRepeat: "repeat",
          }}
        />
      </div>
    );
  }
);

CertificatePreview.displayName = "CertificatePreview";

export default CertificatePreview;
