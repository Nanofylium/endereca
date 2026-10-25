// Sem janela de console no Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// O painel não expõe nenhum comando nativo: a janela só mostra a interface,
// e toda a regra de negócio fica na API.
fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("não foi possível abrir o painel");
}
