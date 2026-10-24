use std::net::{SocketAddr, UdpSocket};
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

struct UdpState {
    current_port: Arc<AtomicU16>,
    last_sender: Arc<Mutex<Option<SocketAddr>>>,
}

#[tauri::command]
fn get_udp_port(state: State<'_, UdpState>) -> u16 {
    state.current_port.load(Ordering::Relaxed)
}

#[tauri::command]
fn change_udp_port(app_handle: AppHandle, state: State<'_, UdpState>, port: u16) -> Result<u16, String> {
    let current = state.current_port.load(Ordering::Relaxed);
    if current == port {
        return Ok(port);
    }

    state.current_port.store(port, Ordering::Relaxed);
    thread::sleep(Duration::from_millis(600));

    let socket = UdpSocket::bind(format!("0.0.0.0:{}", port))
        .map_err(|e| format!("Failed to bind UDP port {}: {}", port, e))?;

    socket
        .set_read_timeout(Some(Duration::from_millis(500)))
        .map_err(|e| format!("Failed to set socket timeout: {}", e))?;

    let port_ref = state.current_port.clone();
    let sender_ref = state.last_sender.clone();

    thread::spawn(move || {
        println!("UDP receiver listening on 0.0.0.0:{}", port);
        let mut buffer = [0u8; 4096];

        while port_ref.load(Ordering::Relaxed) == port {
            match socket.recv_from(&mut buffer) {
                Ok((size, sender)) => {
                    if let Ok(mut lock) = sender_ref.lock() {
                        *lock = Some(sender);
                    }
                    let message = String::from_utf8_lossy(&buffer[..size]).to_string();
                    if let Err(error) = app_handle.emit("udp-message", &message) {
                        eprintln!("Failed to emit UDP message: {}", error);
                    }
                }
                Err(ref e)
                    if e.kind() == std::io::ErrorKind::WouldBlock
                        || e.kind() == std::io::ErrorKind::TimedOut =>
                {
                    continue;
                }
                Err(error) => {
                    eprintln!("UDP receive error on port {}: {}", port, error);
                    thread::sleep(Duration::from_millis(100));
                }
            }
        }
        println!("UDP receiver loop on port {} stopped.", port);
    });

    Ok(port)
}

fn get_target_addr(state: &State<'_, UdpState>, target_port: u16) -> Result<SocketAddr, String> {
    let guard = state.last_sender.lock().map_err(|e| e.to_string())?;
    match *guard {
        Some(addr) => Ok(SocketAddr::new(addr.ip(), target_port)),
        None => format!("127.0.0.1:{}", target_port)
            .parse()
            .map_err(|e| format!("Invalid fallback address: {}", e)),
    }
}

/// Sends remote throttle command to ESP32 on port 8889.
/// Format matches ESP32 receiveThrottle(): [1, throttlePercent]
#[tauri::command]
fn send_throttle(state: State<'_, UdpState>, throttle: u8) -> Result<String, String> {
    let target = get_target_addr(&state, 8889)?;
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    let packet = [1u8, throttle];
    socket.send_to(&packet, target).map_err(|e| e.to_string())?;
    Ok(format!("Sent throttle {}% to {}", throttle, target))
}

/// Sends emergency stop command to ESP32 on port 8889.
/// Format matches ESP32 receiveThrottle(): [2, 4]
#[tauri::command]
fn send_emergency_stop(state: State<'_, UdpState>) -> Result<String, String> {
    let target = get_target_addr(&state, 8889)?;
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    let packet = [2u8, 4u8];
    socket.send_to(&packet, target).map_err(|e| e.to_string())?;
    Ok(format!("Emergency stop dispatched to {}", target))
}

/// Sends text command (START, STOP, VALVE ON, etc.) to ESP32 on port 8889.
#[tauri::command]
fn send_command(state: State<'_, UdpState>, command: String) -> Result<String, String> {
    let target = get_target_addr(&state, 8889)?;
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket.send_to(command.as_bytes(), target).map_err(|e| e.to_string())?;
    Ok(format!("Command \"{}\" sent to {}", command, target))
}

/// Manually set target drone IP address if broadcast was used
#[tauri::command]
fn set_target_drone_ip(state: State<'_, UdpState>, ip: String) -> Result<String, String> {
    let parsed: std::net::IpAddr = ip.parse().map_err(|e| format!("Invalid IP address: {}", e))?;
    let mut lock = state.last_sender.lock().map_err(|e| e.to_string())?;
    *lock = Some(SocketAddr::new(parsed, 8889));
    Ok(format!("Target drone IP set to {}", parsed))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_port = Arc::new(AtomicU16::new(8888));
    let last_sender = Arc::new(Mutex::new(None));
    let udp_state = UdpState {
        current_port: initial_port.clone(),
        last_sender: last_sender.clone(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(udp_state)
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let socket = UdpSocket::bind("0.0.0.0:8888").expect("Failed to bind initial UDP socket");
            socket.set_read_timeout(Some(Duration::from_millis(500))).ok();

            let port_ref = initial_port;
            let sender_ref = last_sender;

            thread::spawn(move || {
                println!("Initial UDP receiver listening on 0.0.0.0:8888");
                let mut buffer = [0u8; 4096];

                while port_ref.load(Ordering::Relaxed) == 8888 {
                    match socket.recv_from(&mut buffer) {
                        Ok((size, sender)) => {
                            if let Ok(mut lock) = sender_ref.lock() {
                                *lock = Some(sender);
                            }
                            let message = String::from_utf8_lossy(&buffer[..size]).to_string();
                            if let Err(error) = app_handle.emit("udp-message", &message) {
                                eprintln!("Failed to emit UDP message: {}", error);
                            }
                        }
                        Err(ref e)
                            if e.kind() == std::io::ErrorKind::WouldBlock
                                || e.kind() == std::io::ErrorKind::TimedOut =>
                        {
                            continue;
                        }
                        Err(error) => {
                            eprintln!("UDP receive error: {}", error);
                            thread::sleep(Duration::from_millis(100));
                        }
                    }
                }
                println!("Initial UDP receiver loop stopped.");
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_udp_port,
            change_udp_port,
            send_throttle,
            send_emergency_stop,
            send_command,
            set_target_drone_ip
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}