# Instrucciones para Actualizar Schema en el VPS

## Problema
El `schema.prisma` en el VPS todavía tiene `categoriaTexto` definido, pero la columna no existe en la base de datos.

## Solución

### Paso 1: Copiar schema.prisma actualizado al VPS

**Desde tu máquina local:**
```bash
scp prisma/schema.prisma root@147.93.118.121:/var/www/html/dentali/prisma/
```

### Paso 2: En el VPS, regenerar Prisma Client

```bash
cd /var/www/html/dentali

# Regenerar Prisma Client con el schema actualizado
npx prisma generate
```

### Paso 3: Ejecutar el seed

```bash
node prisma/seed.js
```

### Paso 4: Reiniciar aplicación

```bash
pm2 restart dentali
```

## Verificación

Después de ejecutar, verifica que no hay errores:
```bash
pm2 logs dentali --lines 20
```




