document.getElementById("btnBackup").addEventListener("click", async () => {
    try {
        // 📢 Mostrar mensaje de carga
        const btn = document.getElementById("btnBackup");
        btn.disabled = true;
        btn.textContent = "Generando Backup... ⏳";

        const response = await fetch("/api/backup/generar");
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || "Error desconocido en el servidor.");
        }

        // 📌 Crear enlace de descarga
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "backup.sql";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        Swal.fire({
            icon: "success",
            title: "Backup generado",
            text: "El backup se descargó correctamente.",
            confirmButtonText: "Aceptar"
        });
    } catch (error) {
        console.error("❌ Error al generar backup:", error);
        Swal.fire({
            icon: "error",
            title: "Error al generar backup",
            text: error.message,
            confirmButtonText: "Aceptar"
        });
    } finally {
        const btn = document.getElementById("btnBackup");
        btn.disabled = false;
        btn.textContent = "Generar Backup";
    }
});

document.getElementById("btnRestaurar").addEventListener("click", async () => {
    const inputArchivo = document.createElement("input");
    inputArchivo.type = "file";
    inputArchivo.accept = ".sql";

    inputArchivo.addEventListener("change", async (event) => {
        const archivo = event.target.files[0];
        if (!archivo) return;

        const formData = new FormData();
        formData.append("backup", archivo);

        try {
            const response = await fetch("/api/backup/restaurar", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();
            if (response.ok) {
                Swal.fire({
                    icon: "success",
                    title: "Restauración completada",
                    text: "La base de datos fue restaurada correctamente.",
                    confirmButtonText: "Aceptar"
                });
            } else {
                Swal.fire({
                    icon: "error",
                    title: "Error al restaurar",
                    text: data.error || "Error desconocido.",
                    confirmButtonText: "Aceptar"
                });
            }
        } catch (error) {
            console.error("❌ Error en la restauración:", error);
            Swal.fire({
                icon: "error",
                title: "Error en la restauración",
                text: error.message,
                confirmButtonText: "Aceptar"
            });
        }
    });

    inputArchivo.click();
});
