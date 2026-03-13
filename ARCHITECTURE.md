# 🗺️ System Architecture

> A high-level map of the Sidebar Productivity Suite.

## 🏗️ System Context

The application follows a **Shell Architecture**. The `index.html` (Shell) acts as the host environment, loading individual applications into a sandboxed `iframe`.

```mermaid
graph TD
    User((User))

    subgraph "Host Environment"
        Shell[Shell (index.html)]
        Nav[Navigation Bar]
        Iframe[App Container (Iframe)]
    end

    subgraph "Core Layer (Shared)"
        Bootstrap[bootstrap.js<br/>(Dependency Loader)]
        Core[app-core.js<br/>(Lifecycle & Utils)]
        UI[app-ui.js<br/>(Components)]
        Data[app-data.js<br/>(Persistence)]
    end

    subgraph "Application Layer"
        Dash[Dashboard]
        Calc[Calculator]
        Look[Lookup]
        Mail[MailTo]
        Pass[Passwords]
    end

    subgraph "Workers & Libs"
        Worker[MsgWorker]
        Msg[msg-reader.js]
    end

    User -->|Interacts| Shell
    Shell -->|Manages| Nav
    Shell -->|Loads| Iframe

    Iframe -->|Runs| Bootstrap
    Bootstrap -->|Injects| Core
    Core --> UI
    Core --> Data

    Bootstrap -->|Loads| Dash
    Bootstrap -->|Loads| Calc
    Bootstrap -->|Loads| Look
    Bootstrap -->|Loads| Mail
    Bootstrap -->|Loads| Pass

    Mail -.->|Spawns| Worker
    Worker -->|Imports| Msg

    style Shell fill:#f9f,stroke:#333
    style Bootstrap fill:#ff9,stroke:#333
    style Core fill:#ccf,stroke:#333
    style UI fill:#ccf,stroke:#333
    style Data fill:#ccf,stroke:#333
    style Worker fill:#eef,stroke:#333
```

## 🚀 Bootstrapping Sequence

How an application page initializes within the shell.

```mermaid
sequenceDiagram
    participant Shell
    participant Iframe
    participant Bootstrap
    participant Core
    participant App

    Shell->>Iframe: Load App URL (e.g. dashboard.html)
    Note over Iframe: Script Tags
    Iframe->>Bootstrap: Execute bootstrap.js

    rect rgb(240, 248, 255)
        Note right of Bootstrap: Dependency Loading
        Bootstrap->>Core: Load app-core.js
        Core-->>Bootstrap: Exports Ready
        Bootstrap->>Bootstrap: Load app-ui.js & app-data.js
    end

    Bootstrap->>App: Load App Logic (e.g. dashboard.js)
    App->>Core: AppLifecycle.initPage()
    Core->>App: State & DOM Ready
    App-->>Iframe: Render UI

    App->>Shell: postMessage('app_ready')
    Shell->>Shell: Update Title & URL
```

## 📦 Core Modules

| Module | Responsibility | Key Exports |
| :--- | :--- | :--- |
| **app-core.js** | The "Standard Library". Handles lifecycle, dates, and basic DOM. | `AppLifecycle`, `SafeUI`, `DateUtils` |
| **app-ui.js** | Reusable UI components. | `ListRenderer`, `SharedSettingsModal`, `UIPatterns` |
| **app-data.js** | Data persistence and transformation. | `BackupRestore`, `CsvManager`, `DataValidator` |

## 📧 MailTo Worker Flow

The MailTo app uses a Web Worker to parse binary `.msg` files off the main thread.

```mermaid
graph LR
    User[User] -->|Drops File| App[MailTo App]
    App -->|postMessage(ArrayBuffer)| Worker[MsgWorker]

    subgraph "Background Thread"
        Worker -->|Imports| Reader[msg-reader.js]
        Reader -->|Parses| Buffer[Binary Data]
        Buffer -->|Returns| JSON[Clean JSON]
    end

    Worker -->|postMessage(JSON)| App
    App -->|Updates| UI[Editor UI]
```

## 🧱 Component Diagrams

### Dashboard Data Flow
```mermaid
C4Component
    title Dashboard Sub-System Component Map

    Container_Boundary(dashboard_app, "Dashboard Application") {
        Component(dash_logic, "dashboard.js", "Javascript", "Manages local applications, shortcuts, and notepad state")
        Component(dash_ui, "dashboard.html", "HTML", "Dashboard user interface")

        Component(core_lifecycle, "AppLifecycle", "JS Module", "Page initialization and auto-save")
        Component(ui_notepad, "NotepadManager", "JS Module", "Reusable scratchpad UI component")
        Component(ui_quicklist, "QuickListManager", "JS Module", "Reusable fast-access list rendering")
    }

    ContainerDb(local_storage, "localStorage", "Browser Storage", "Stores dashboard state")

    Rel(dash_logic, dash_ui, "Renders to")
    Rel(dash_logic, core_lifecycle, "Initializes via")
    Rel(dash_logic, ui_notepad, "Instantiates")
    Rel(dash_logic, ui_quicklist, "Instantiates")
    Rel(core_lifecycle, local_storage, "Reads/Writes JSON")
    Rel(ui_notepad, local_storage, "Auto-saves to")
```

### MailTo Architecture
```mermaid
C4Component
    title MailTo App Component Map

    Container_Boundary(mailto_app, "MailTo Application") {
        Component(mail_logic, "mailto.js", "Javascript", "Handles email templates and .msg processing")
        Component(mail_ui, "mailto.html", "HTML", "MailTo editor and library interface")

        Component(worker_interface, "MsgWorker", "Web Worker", "Offloads .msg parsing")

        Component(tree_utils, "TreeUtils", "JS Module", "Manages folder hierarchy logic")
        Component(data_converter, "DataConverter", "JS Module", "CSV import/export")
    }

    System_Ext(default_email, "Default Mail Client", "OS Level", "Handles mailto: links")

    Rel(mail_logic, mail_ui, "Updates DOM")
    Rel(mail_ui, mail_logic, "Events (Click/DragDrop)")

    Rel(mail_logic, worker_interface, "Posts binary data")
    Rel(worker_interface, mail_logic, "Returns JSON")

    Rel(mail_logic, tree_utils, "Navigates structure")
    Rel(mail_logic, data_converter, "Exports Library")

    Rel(mail_logic, default_email, "Opens mailto: URLs")
```

### Lookup Architecture
```mermaid
C4Component
    title Lookup App Component Map

    Container_Boundary(lookup_app, "Lookup Application") {
        Component(lookup_logic, "lookup.js", "Javascript", "Manages local entries and external custom searches")
        Component(lookup_ui, "lookup.html", "HTML", "Search interface and results display")

        Component(lookup_helpers, "LookupHelpers", "JS Object", "Entry validation, creation, and keyword parsing")
        Component(lookup_renderer, "LookupRenderer", "JS Object", "DOM generation for search results and skeletons")
        Component(lookup_csv, "LookupCSV", "JS Object", "Validates CSV rows during import")

        Component(search_helper, "SearchHelper", "JS Module (Shared)", "Asynchronous indexed keyword search")
    }

    ContainerDb(local_storage, "localStorage", "Browser Storage", "Stores entry database and custom searches")
    System_Ext(external_kb, "External Knowledge Base", "Web Service", "Target for custom URL templates")

    Rel(lookup_logic, lookup_ui, "Updates DOM via Renderer")
    Rel(lookup_ui, lookup_logic, "Events (Input/Click)")

    Rel(lookup_logic, search_helper, "Queries index")
    Rel(lookup_logic, lookup_helpers, "Validates data")
    Rel(lookup_logic, lookup_csv, "Validates imports")
    Rel(lookup_logic, lookup_renderer, "Generates HTML fragments")

    Rel(lookup_logic, local_storage, "Reads/Writes JSON")
    Rel(lookup_logic, external_kb, "Opens templated URLs")
```

### Passwords Architecture
```mermaid
C4Component
    title Passwords App Component Map

    Container_Boundary(passwords_app, "Passwords Application") {
        Component(passwords_logic, "passwords.js", "Javascript", "Handles passphrase generation and UI state")
        Component(passwords_ui, "passwords.html", "HTML", "Password generator interface")

        Component(password_logic_obj, "PasswordLogic", "JS Object", "Generates phrases, seasonal logic, entropy mapping")
        Component(password_ui_obj, "PasswordUI", "JS Object", "Updates DOM elements and accordion states")
        Component(password_settings_obj, "PasswordSettings", "JS Object", "Initializes the settings modal")
    }

    ContainerDb(local_storage, "localStorage", "Browser Storage", "Stores generation presets and quick copies")
    System_Ext(crypto_api, "window.crypto", "Browser API", "Cryptographically secure random value generation")
    System_Ext(static_json, "Wordbanks (JSON)", "Static Assets", "Base and seasonal phrase dictionaries")

    Rel(passwords_logic, passwords_ui, "Coordinates")
    Rel(passwords_ui, passwords_logic, "Events (Generate/Save)")

    Rel(passwords_logic, password_logic_obj, "Calls generation logic")
    Rel(passwords_logic, password_ui_obj, "Calls UI updates")
    Rel(passwords_logic, password_settings_obj, "Initializes modal")

    Rel(password_logic_obj, crypto_api, "Requests entropy")
    Rel(passwords_logic, static_json, "Fetches asynchronously")
    Rel(passwords_logic, local_storage, "Reads/Writes JSON")
```
