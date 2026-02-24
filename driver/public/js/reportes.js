// Variables globales
let mainDataTable;
let currentRange = 'mes';
const API_BASE_URL = '/api/reportes';

// --- Funciones de Utilidad ---
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN'
    }).format(amount);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-PE', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    }).format(date);
}

function setSafeHTML(id, html) {
    const el = document.getElementById(id);
    if (el) {
        el.innerHTML = html;
    } else {
        console.warn(`Advertencia: El elemento con id="${id}" no existe en el HTML.`);
    }
}

function setSafeText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text;
    }
}

// --- Análisis de Productos ---

/**
 * Extrae y procesa los productos de todas las ventas
 * Retorna un mapa con: nombre, cantidad total, ingresos totales, y ganancia total
 */
function parseProductsFromSales(data) {
    // Validar que data sea un array
    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }
    
    const productMap = {};
    
    data.forEach(venta => {
        const productosText = venta.productos_vendidos || '';
        const totalVenta = parseFloat(venta.total_ventas) || 0;
        const profit = parseFloat(venta.profit) || 0;
        
        // Si no hay productos o valores, saltar
        if (!productosText.trim() || totalVenta === 0) {
            return;
        }
        
        // Regex para extraer: "Nombre Producto (X uds)"
        const regex = /([^,(]+)\s*\((\d+)\s+uds?\)/gi;
        let match;
        let totalUnitsInSale = 0;
        const productsInSale = [];
        
        // Primera pasada: contar unidades totales
        while ((match = regex.exec(productosText)) !== null) {
            const nombre = match[1].trim();
            const cantidad = parseInt(match[2]);
            
            if (nombre && cantidad > 0) {
                totalUnitsInSale += cantidad;
                productsInSale.push({ nombre, cantidad });
            }
        }
        
        // Segunda pasada: distribuir ingresos y ganancia proporcionalmente
        if (totalUnitsInSale > 0) {
            productsInSale.forEach(({ nombre, cantidad }) => {
                if (!productMap[nombre]) {
                    productMap[nombre] = {
                        nombre: nombre,
                        cantidadTotal: 0,
                        ingresosTotal: 0,
                        gananciaTotal: 0,
                        numVentas: 0
                    };
                }
                
                // Proporción de este producto en la venta
                const proporcion = cantidad / totalUnitsInSale;
                
                productMap[nombre].cantidadTotal += cantidad;
                productMap[nombre].ingresosTotal += totalVenta * proporcion;
                productMap[nombre].gananciaTotal += profit * proporcion;
                productMap[nombre].numVentas += 1;
            });
        }
    });
    
    return Object.values(productMap);
}

/**
 * Obtiene los productos más vendidos por cantidad
 */
function getTopProductsByQuantity(data, limit = 5) {
    const products = parseProductsFromSales(data);
    
    if (products.length === 0) {
        return [];
    }
    
    return products
        .sort((a, b) => b.cantidadTotal - a.cantidadTotal)
        .slice(0, limit);
}

/**
 * Obtiene los productos menos vendidos por cantidad
 */
function getBottomProductsByQuantity(data, limit = 5) {
    const products = parseProductsFromSales(data);
    
    if (products.length === 0) {
        return [];
    }
    
    return products
        .sort((a, b) => a.cantidadTotal - b.cantidadTotal)
        .slice(0, limit);
}

/**
 * Obtiene los productos con mayor ganancia
 */
function getTopProductsByProfit(data, limit = 5) {
    const products = parseProductsFromSales(data);
    
    if (products.length === 0) {
        return [];
    }
    
    return products
        .sort((a, b) => b.gananciaTotal - a.gananciaTotal)
        .slice(0, limit);
}

/**
 * Renderiza la sección de Top Productos Más Vendidos
 */
function updateTopProducts(data) {
    const topProducts = getTopProductsByQuantity(data, 5);
    
    if (topProducts.length === 0) {
        setSafeHTML('top-productos', '<p class="text-muted text-center py-4">No hay productos registrados</p>');
        return;
    }
    
    let html = '<div class="list-group list-group-flush">';
    topProducts.forEach((producto, index) => {
        const badgeColor = index === 0 ? 'warning' : index === 1 ? 'secondary' : 'info';
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        
        html += `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <span class="badge bg-${badgeColor} me-2">${index + 1}</span>
                            <span class="me-1">${medal}</span>
                            <strong>${producto.nombre}</strong>
                        </div>
                        <div class="small text-muted">
                            <i class="fas fa-shopping-cart"></i> ${producto.numVentas} venta(s) 
                            • <i class="fas fa-coins"></i> ${formatCurrency(producto.ingresosTotal)}
                        </div>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-primary rounded-pill">${producto.cantidadTotal} uds</span>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    setSafeHTML('top-productos', html);
}

/**
 * Renderiza la sección de Productos Menos Vendidos
 */
function updateBottomProducts(data) {
    const bottomProducts = getBottomProductsByQuantity(data, 5);
    
    if (bottomProducts.length === 0) {
        setSafeHTML('bottom-productos', '<p class="text-muted text-center py-3">No hay productos registrados</p>');
        return;
    }
    
    let html = '<div class="list-group list-group-flush">';
    bottomProducts.forEach((producto, index) => {
        html += `
            <div class="list-group-item px-0">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="mb-1">
                            <strong>${producto.nombre}</strong>
                        </div>
                        <div class="small text-muted">
                            <i class="fas fa-shopping-cart"></i> ${producto.numVentas} venta(s) 
                            • <i class="fas fa-dollar-sign"></i> ${formatCurrency(producto.ingresosTotal)}
                        </div>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-secondary rounded-pill">${producto.cantidadTotal} uds</span>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    setSafeHTML('bottom-productos', html);
}

/**
 * Renderiza la sección de Productos con Mayor Ganancia
 */
function updateTopProfitProducts(data) {
    const topProfitProducts = getTopProductsByProfit(data, 5);
    
    if (topProfitProducts.length === 0) {
        setSafeHTML('top-profit-productos', '<p class="text-muted text-center py-4">No hay productos registrados</p>');
        return;
    }
    
    let html = '<div class="list-group list-group-flush">';
    topProfitProducts.forEach((producto, index) => {
        const margen = producto.ingresosTotal > 0 
            ? (producto.gananciaTotal / producto.ingresosTotal * 100) 
            : 0;
        const badgeColor = index === 0 ? 'success' : 'info';
        
        html += `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-1">
                            <span class="badge bg-${badgeColor} me-2">${index + 1}</span>
                            <strong>${producto.nombre}</strong>
                        </div>
                        <div class="small text-muted">
                            <i class="fas fa-box"></i> ${producto.cantidadTotal} uds vendidas
                            • <i class="fas fa-chart-line"></i> Margen: ${margen.toFixed(1)}%
                        </div>
                    </div>
                    <div class="text-end">
                        <div class="text-success fw-bold">${formatCurrency(producto.gananciaTotal)}</div>
                        <div class="small text-muted">${formatCurrency(producto.ingresosTotal)} ingresos</div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    setSafeHTML('top-profit-productos', html);
}

// --- Lógica de Datos Original ---

async function loadSalesReports(range = 'mes') {
    try {
        const loading = document.getElementById('loadingContainer');
        const tableCont = document.getElementById('tableContainer');
        
        if (loading) loading.style.display = 'block';
        if (tableCont) tableCont.style.display = 'none';

        const response = await fetch(`${API_BASE_URL}?rango=${range}`);
        if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);

        const data = await response.json();
        
        // Asegurar que data sea un array
        const salesData = Array.isArray(data) ? data : [];

        const titles = { 'hoy': 'Hoy', 'semana': 'Esta Semana', 'mes': 'Este Mes' };
        setSafeText('tableTitle', `Reportes de Ventas - ${titles[range] || range}`);

        updateSalesSummary(salesData);
        updatePaymentMethodsTotals(salesData);
        renderTable(salesData);
        
        // NUEVAS FUNCIONES: Actualizar análisis de productos
        updateTopProducts(salesData);
        updateBottomProducts(salesData);
        updateTopProfitProducts(salesData);

        const btnExport = document.getElementById('exportarBtn');
        if (btnExport) btnExport.disabled = salesData.length === 0;
        
        if (loading) loading.style.display = 'none';
        if (tableCont) tableCont.style.display = 'block';

    } catch (error) {
        console.error('Error:', error);
        const errCont = document.getElementById('errorContainer');
        if (errCont) {
            errCont.textContent = `Error al cargar los reportes: ${error.message}`;
            errCont.style.display = 'block';
        }
        const loading = document.getElementById('loadingContainer');
        if (loading) loading.style.display = 'none';
    }
}

function updateSalesSummary(data) {
    // Validar que data sea un array
    if (!Array.isArray(data)) {
        console.warn('updateSalesSummary: data no es un array');
        data = [];
    }
    
    let totalVentas = data.length;
    let totalIngresos = 0;
    let totalProductos = 0;
    let totalProfit = 0;

    data.forEach(row => {
        totalIngresos += parseFloat(row.total_ventas) || 0;
        totalProfit += parseFloat(row.profit) || 0;
        
        const productosText = row.productos_vendidos || '';
        const matches = productosText.match(/\((\d+)\s+uds?\)/g);
        if (matches) {
            matches.forEach(match => {
                const num = match.match(/\((\d+)/);
                if (num) totalProductos += parseInt(num[1]) || 0;
            });
        }
    });

    const promedioVenta = totalVentas > 0 ? totalIngresos / totalVentas : 0;

    setSafeText('total-ventas-count', totalVentas);
    setSafeText('total-ingresos', formatCurrency(totalIngresos));
    setSafeText('total-productos', totalProductos);
    setSafeText('promedio-venta', formatCurrency(promedioVenta));
    setSafeText('total-profit', formatCurrency(totalProfit));
}

function updatePaymentMethodsTotals(data) {
    // Validar que data sea un array
    if (!Array.isArray(data)) {
        console.warn('updatePaymentMethodsTotals: data no es un array');
        data = [];
    }
    
    const totales = {};
    data.forEach(venta => {
        if (Array.isArray(venta.pagos)) {
            venta.pagos.forEach(pago => {
                const metodo = pago.metodo || 'Otros';
                totales[metodo] = (totales[metodo] || 0) + parseFloat(pago.monto);
            });
        }
    });

    if (Object.keys(totales).length === 0) {
        setSafeHTML('totales-por-metodo', '<span class="text-muted">No hay pagos registrados en este período</span>');
        return;
    }

    let html = '<div class="row">';
    for (const [metodo, monto] of Object.entries(totales)) {
        html += `
            <div class="col-md-3 mb-2">
                <div class="border-start border-4 border-info ps-3">
                    <div class="small text-muted">${metodo}</div>
                    <div class="h5 mb-0 font-weight-bold">${formatCurrency(monto)}</div>
                </div>
            </div>`;
    }
    html += '</div>';
    setSafeHTML('totales-por-metodo', html);
}

function renderTable(data) {
    const contenedor = document.getElementById('contenedor-tabla-ventas');
    if (!contenedor) return;

    // Validar que data sea un array
    if (!Array.isArray(data)) {
        console.warn('renderTable: data no es un array');
        data = [];
    }

    if (mainDataTable) {
        mainDataTable.destroy();
        mainDataTable = null;
    }

    contenedor.innerHTML = `
        <table id="tablaVentasPrincipal" class="table table-striped table-bordered">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Subtotal</th>
                    <th>IGV</th>
                    <th>Total B.</th>
                    <th>Ganancia</th>
                    <th>Métodos de Pago</th>
                    <th>Productos</th>
                </tr>
            </thead>
            <tbody id="salesTableBody"></tbody>
        </table>
    `;

    const tbody = document.getElementById('salesTableBody');
    
    // Si no hay datos, mostrar mensaje
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    <i class="fas fa-inbox fa-2x mb-2"></i>
                    <p>No hay ventas registradas en este período</p>
                </td>
            </tr>
        `;
        return;
    }

    data.forEach(row => {
        const tr = document.createElement('tr');
        const pagosTexto = Array.isArray(row.pagos)
            ? row.pagos.map(p => `${p.metodo}: ${formatCurrency(p.monto)}`).join('<br>')
            : '—';

        const profit = parseFloat(row.profit) || 0;
        const profitClass = profit >= 0 ? 'text-success' : 'text-danger';
        const profitIcon = profit >= 0 ? '↑' : '↓';

        tr.innerHTML = `
            <td>${formatDate(row.fecha)}</td>
            <td>${formatCurrency(parseFloat(row.total_subtotal))}</td>
            <td>${formatCurrency(parseFloat(row.total_igv))}</td>
            <td><strong>${formatCurrency(parseFloat(row.total_ventas))}</strong></td>
            <td class="${profitClass} fw-bold">
                ${profitIcon} ${formatCurrency(profit)}
            </td>
            <td>${pagosTexto}</td>
            <td title="${row.productos_vendidos || ''}">
                ${(row.productos_vendidos || '').length > 50 ? row.productos_vendidos.substring(0, 50) + '...' : (row.productos_vendidos || '—')}
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (data.length > 0) {
        mainDataTable = new simpleDatatables.DataTable("#tablaVentasPrincipal", {
            searchable: true,
            fixedHeight: false,
            perPage: 25,
            labels: {
                placeholder: "Buscar...",
                perPage: "registros por página",
                noRows: "No se encontraron registros",
                info: "Mostrando {start} a {end} de {rows} registros"
            }
        });
    }
}

// --- Eventos ---
document.addEventListener('DOMContentLoaded', () => {
    loadSalesReports(currentRange);

    const btnFiltro = document.getElementById('aplicarFiltro');
    if (btnFiltro) {
        btnFiltro.addEventListener('click', () => {
            const select = document.getElementById('rangoFiltro');
            if (select) {
                currentRange = select.value;
                loadSalesReports(currentRange);
            }
        });
    }

    const selectFiltro = document.getElementById('rangoFiltro');
    if (selectFiltro) {
        selectFiltro.addEventListener('change', (e) => {
            currentRange = e.target.value;
            loadSalesReports(currentRange);
        });
    }

    const btnExport = document.getElementById('exportarBtn');
    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            const originalText = btnExport.innerHTML;
            try {
                btnExport.innerHTML = '<i class="fas fa-spinner fa-spin"></i>...';
                btnExport.disabled = true;
                const response = await fetch(`${API_BASE_URL}/exportar?rango=${currentRange}`);
                if (!response.ok) throw new Error("Error al exportar");
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Reporte_${currentRange}.xlsx`;
                a.click();
            } catch (e) { alert(e.message); }
            finally { 
                btnExport.innerHTML = originalText;
                btnExport.disabled = false;
            }
        });
    }
});