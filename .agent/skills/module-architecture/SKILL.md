---
name: module-architecture
description: Cargar cuando se diseña o crea un módulo nuevo. Define la estructura de carpetas, la anatomía obligatoria vs opcional y las convenciones de naming.
---

# Module Architecture

## Cuándo usar
Siempre que se vaya a crear o planificar un **módulo nuevo** dentro de `modules/`.

## Anatomía de un módulo

### Núcleo obligatorio (todo módulo lo tiene)

```
modules/<module-name>/
├── <module-name>-content.tsx   ← Componente servidor (entry point SSR de la vista)
└── lib/
    ├── actions/
    │   └── <entity>.actions.ts  ← "use server" — wrappers que llaman a services
    ├── services/
    │   └── <entity>.services.ts ← "server-only" — lógica real (DB, API, mock)
    ├── types/
    │   └── <entity>.types.ts    ← Tipos, DTOs, converters, enum config helpers
    ├── hooks/                   ← Hooks cliente (llaman a actions, manejan loading/error)
    │   └── use-<verb>-<entity>.tsx
    └── mock/                    ← Datos mock en memoria (solo para template/dev)
        └── <entities>.data.ts
```

### Features opcionales (según el módulo)

```
modules/<module-name>/
├── list/           ← Vista de lista (tabla + cards) — si el módulo tiene listado
├── form/           ← Formularios create/edit — si el módulo permite creación/edición
│   ├── create/
│   │   ├── schemas/
│   │   ├── create-<entity>-form-container.tsx
│   │   └── create-<entity>-trigger.tsx
│   └── edit/
│       ├── schemas/
│       ├── edit-<entity>-container.tsx
│       └── edit-<entity>-form-container.tsx
├── filters/        ← Filtros con estado URL — si el módulo tiene filtrado
├── details/        ← Vista de detalle — si el módulo tiene detalle de item
├── delete/         ← Confirmación de borrado — si el módulo permite borrar
├── activate/       ← Toggle activo/inactivo — si el módulo tiene estado activo
└── components/     ← Componentes específicos del módulo (botones de reporte, etc.)
```

## Convenciones de naming

| Tipo | Convención | Ejemplo |
|---|---|---|
| Archivos | kebab-case | `widget-list-container.tsx` |
| Componentes | PascalCase | `WidgetListContainer` |
| Hooks | camelCase prefijo `use` | `useCreateWidget` |
| Actions | camelCase sufijo `Action` | `createWidgetAction` |
| Services | camelCase (sin sufijo) | `createWidget` |
| Types/Interfaces | PascalCase | `CreateWidgetDto`, `WidgetDetails` |
| Carpeta del módulo | kebab-case plural | `item-categories`, `users`, `widgets` |

## Módulos vs Features vs Tipos

| Tipo de módulo | ¿Tiene list? | ¿Tiene form? | ¿Tiene filters? | Ejemplo |
|---|---|---|---|---|
| CRUD completo | ✅ | ✅ | ✅ | `item-categories`, `users` |
| Solo lectura | ✅ | ❌ | ✅ | Dashboard de reportes |
| Configuración | ❌ | ✅ | ❌ | Settings de perfil |
| Dashboard | ❌ | ❌ | ❌ | Métricas y resúmenes |
| Wizard/proceso | ❌ | ✅ (multistep) | ❌ | Onboarding |

## Integraciones con APIs externas (opcional)

Los endpoints externos no pertenecen a un módulo concreto. Se organizan en la
raíz compartida del proyecto:

```
lib/
└── api/
    └── routes/
        └── <upstream>-api.routes.ts ← catálogo server-only de rutas relativas
```

Se crea un catálogo por upstream, agrupado por recurso, y los módulos lo
importan mediante `@/lib/api/routes/<upstream>-api.routes`. El catálogo comienza
con `import "server-only"` y contiene solo rutas relativas; el service del
módulo conserva la lectura y validación de la base URL privada, además de
componer la URL final. Así, añadir otra API requiere otro catálogo y otra
configuración de servidor sin duplicar endpoints entre módulos ni mezclar hosts.

Ver las reglas completas y el ejemplo de consumo en `data-layer` y
`.agent/reference/widget/lib/api/routes/`.

## Componentes compartidos importantes

Antes de crear nada nuevo, consultar:

```
@/modules/components/module-header/     ← Header estándar de módulo con título, icono, acciones
@/components/modal/modal.tsx            ← Modal estándar del proyecto
@/components/filters/filter-card/       ← Wrapper de filtros
@/components/filters/filters-container-skeleton/
@/components/pagination/module-pagination.tsx
@/components/details-container-wrapper/ ← Wrapper para carga de detalles en edit
@/components/form/rhf-components/       ← RHFTextField, RHFSelectField, etc.
@/components/form/components/form-action-footer.tsx
@/modules/hooks/use-edit-item-list-action.ts   ← Hook genérico re-exportable con alias
@/modules/hooks/use-view-item-list-action.ts
@/modules/hooks/use-delete-item-list-action.ts
@/lib/api-responses.ts                  ← Tipo ServiceResponse<T>
@/lib/mock/in-memory-store.ts           ← queryCollection, createRecord, updateRecord, deleteRecord, findById
```

## Checklist de diseño de módulo

- [ ] ¿Qué features incluye este módulo? (list / form / filters / details / delete / activate)
- [ ] ¿Cuáles son las entidades y sus tipos principales?
- [ ] ¿Qué DTOs necesita (Create, Edit, Filters)?
- [ ] ¿Qué acciones tiene el usuario (CRUD, bulk, toggle)?
- [ ] ¿Qué namespace de i18n usará?
- [ ] ¿Qué icono de Lucide usa en el `ModuleHeader`?

## Referencia navegable

Ver implementación completa: `.agent/reference/widget/`
