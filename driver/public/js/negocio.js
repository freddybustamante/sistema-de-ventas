// aca se cargan los datos y descipcion del negocio qr y logo del negocio
document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("formNegocio");

    // 📌 Cargar datos existentes
    try {
        const res = await fetch("/api/negocio");
        if (!res.ok) throw new Error("Error al obtener negocio");
        const negocio = await res.json();

        if (negocio) {
            // Rellenar los inputs del formulario
            document.getElementById("empresa_nombre").value = negocio.empresa_nombre || "";
            document.getElementById("empresa_ruc").value = negocio.empresa_ruc || "";
            document.getElementById("empresa_descripcion").value = negocio.empresa_descripcion || "";
            document.getElementById("empresa_direccion").value = negocio.empresa_direccion || "";
            document.getElementById("empresa_telefono").value = negocio.empresa_telefono || "";
            document.getElementById("empresa_email").value = negocio.empresa_email || "";
            document.getElementById("empresa_web").value = negocio.empresa_web || "";
            
            // 📌 NUEVO: Rellenar campos adicionales
            document.getElementById("empresa_servicios").value = negocio.empresa_servicios || "";
            document.getElementById("empresa_detalles").value = negocio.empresa_detalles || "";
            document.getElementById("empresa_referencia").value = negocio.empresa_referencia || "";
            document.getElementById("empresa_ubicacion_maps").value = negocio.empresa_ubicacion_maps || "";
            document.getElementById("empresa_departamento").value = negocio.empresa_departamento || "";
            document.getElementById("empresa_provincia").value = negocio.empresa_provincia || "";
            document.getElementById("empresa_distrito").value = negocio.empresa_distrito || "";

            // 📌 Mostrar imágenes existentes
            if (negocio.empresa_logo) {
                mostrarImagenExistente('logoPreview', negocio.empresa_logo);
            }
            if (negocio.empresa_qr) {
                mostrarImagenExistente('qrPreview', negocio.empresa_qr);
            }
        }
    } catch (error) {
        Swal.fire({
            icon: "error",
            title: "Error",
            text: "❌ Error cargando negocio: " + error.message
        });
    }

    // 📌 Vista previa de imágenes
    const inputLogo = document.getElementById("empresa_logo");
    const inputQr = document.getElementById("empresa_qr");
    const logoPreview = document.getElementById("logoPreview");
    const qrPreview = document.getElementById("qrPreview");

    if (inputLogo && logoPreview) {
        inputLogo.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    logoPreview.src = e.target.result;
                    logoPreview.style.display = "block";
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (inputQr && qrPreview) {
        inputQr.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    qrPreview.src = e.target.result;
                    qrPreview.style.display = "block";
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 📌 Botón limpiar
    const btnLimpiar = document.getElementById("btnLimpiar");
    if (btnLimpiar) {
        btnLimpiar.addEventListener("click", async () => {
            const { isConfirmed } = await Swal.fire({
                title: "¿Estás seguro?",
                text: "Se limpiarán todos los campos",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Sí, limpiar",
                cancelButtonText: "Cancelar"
            });

            if (isConfirmed) {
                form.reset();
                if (logoPreview) logoPreview.style.display = "none";
                if (qrPreview) qrPreview.style.display = "none";
            }
        });
    }

    // 📌 Guardar cambios
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = new FormData();
        // Campos del formulario
        formData.append("empresa_nombre", document.getElementById("empresa_nombre").value.trim());
        formData.append("empresa_ruc", document.getElementById("empresa_ruc").value.trim());
        formData.append("empresa_descripcion", document.getElementById("empresa_descripcion").value.trim());
        formData.append("empresa_servicios", document.getElementById("empresa_servicios").value.trim());
        formData.append("empresa_detalles", document.getElementById("empresa_detalles").value.trim());
        formData.append("empresa_direccion", document.getElementById("empresa_direccion").value.trim());
        formData.append("empresa_referencia", document.getElementById("empresa_referencia").value.trim());
        formData.append("empresa_departamento", document.getElementById("empresa_departamento").value.trim());
        formData.append("empresa_provincia", document.getElementById("empresa_provincia").value.trim());
        formData.append("empresa_distrito", document.getElementById("empresa_distrito").value.trim());
        formData.append("empresa_ubicacion_maps", document.getElementById("empresa_ubicacion_maps").value.trim());
        formData.append("empresa_telefono", document.getElementById("empresa_telefono").value.trim());
        formData.append("empresa_web", document.getElementById("empresa_web").value.trim());
        formData.append("empresa_email", document.getElementById("empresa_email").value.trim());

        const logoFile = document.getElementById("empresa_logo")?.files[0];
        const qrFile = document.getElementById("empresa_qr")?.files[0];

        if (logoFile) formData.append("empresa_logo", logoFile);
        if (qrFile) formData.append("empresa_qr", qrFile);

        try {
            const res = await fetch("/api/negocio", {
                method: "POST",
                body: formData
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.message || "Error al guardar");

            Swal.fire({
                icon: "success",
                title: "Éxito",
                text: "Datos del negocio guardados correctamente",
                timer: 2000,
                showConfirmButton: false
            });

            setTimeout(() => window.location.reload(), 2100);

        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: error.message
            });
        }
    });
});

// 📌 Mostrar imagen existente
function mostrarImagenExistente(previewId, src) {
    const preview = document.getElementById(previewId);
    if (preview && src) {
        preview.src = src;
        preview.style.display = "block";
        Swal.fire({
            icon: "info",
            title: "Imagen cargada",
            text: `Se mostró la imagen en ${previewId}`
        });
    }
}

// 📌 Eliminar imagen específica
async function eliminarImagen(tipo) {
    const { isConfirmed } = await Swal.fire({
        title: "¿Estás seguro?",
        text: `¿Deseas eliminar el ${tipo === 'logo' ? 'logo' : 'código QR'}?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar"
    });

    if (!isConfirmed) return;

    try {
        const res = await fetch(`/api/negocio/imagen/${tipo}`, {
            method: "DELETE"
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Error al eliminar");

        // Ocultar preview
        const preview = document.getElementById(`preview-${tipo}`);
        if (preview) preview.style.display = "none";

        // Limpiar input
        const input = document.getElementById(`empresa_${tipo}`);
        if (input) input.value = "";

        Swal.fire({
            icon: "success",
            title: "Eliminado",
            text: result.message,
            timer: 1500,
            showConfirmButton: false
        });

    } catch (error) {
        Swal.fire({
            icon: "error",
            title: "Error",
            text: error.message
        });
    }
}
