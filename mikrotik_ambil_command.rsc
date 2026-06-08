# SCRIPT MIKROTIK - AMBIL COMMAND DARI NETLIFY FUNCTION
# RouterOS 6.x
#
# GANTI proxyUrl dengan URL Netlify Function sampean.
# Contoh:
# :local proxyUrl "https://pencatatan-wifi.netlify.app/.netlify/functions/mikrotik"

:local proxyUrl "https://NAMA-SITE-SAMPEAN.netlify.app/.netlify/functions/mikrotik"
:local key "tandonetwork123"
:local fileName "wifi_cmd.txt"

:do {
    /tool fetch url=($proxyUrl . "?action=getPendingCommand&key=" . $key) mode=https check-certificate=no dst-path=$fileName
} on-error={
    :log warning "WIFI-APP: gagal fetch getPendingCommand dari Netlify"
    :return
}

:delay 1s

:local result [/file get $fileName contents]
:set result [:pick $result 0 [:len $result]]

:if ($result = "") do={
    :log warning "WIFI-APP: response kosong"
    :return
}

:if ($result = "EMPTY") do={
    :log info "WIFI-APP: tidak ada pending command"
    :return
}

:if ([:pick $result 0 3] != "OK|") do={
    :log warning ("WIFI-APP: response tidak OK: " . $result)
    :return
}

# Format: OK|ID|NAMA|PASSWORD|PROFIL
:local rest [:pick $result 3 [:len $result]]
:local p1 [:find $rest "|"]
:local cmdId [:pick $rest 0 $p1]
:set rest [:pick $rest ($p1 + 1) [:len $rest]]

:local p2 [:find $rest "|"]
:local nama [:pick $rest 0 $p2]
:set rest [:pick $rest ($p2 + 1) [:len $rest]]

:local p3 [:find $rest "|"]
:local pass [:pick $rest 0 $p3]
:local profil [:pick $rest ($p3 + 1) [:len $rest]]

:if ([:len [/ppp profile find name=$profil]] = 0) do={
    :log warning ("WIFI-APP: profile tidak ditemukan: " . $profil)
    /tool fetch url=($proxyUrl . "?action=markCommandDone&key=" . $key . "&id=" . $cmdId . "&status=ERROR&message=PROFILE_TIDAK_DITEMUKAN") mode=https check-certificate=no dst-path="wifi_mark.txt"
    :return
}

:if ([:len [/ppp secret find name=$nama]] > 0) do={
    :log warning ("WIFI-APP: PPP sudah ada: " . $nama)
    /tool fetch url=($proxyUrl . "?action=markCommandDone&key=" . $key . "&id=" . $cmdId . "&status=ERROR&message=PPP_SUDAH_ADA") mode=https check-certificate=no dst-path="wifi_mark.txt"
    :return
}

:do {
    /ppp secret add name=$nama password=$pass profile=$profil service=pppoe comment="created-by-wifi-app"
    :log info ("WIFI-APP: PPP berhasil dibuat: " . $nama)
    /tool fetch url=($proxyUrl . "?action=markCommandDone&key=" . $key . "&id=" . $cmdId . "&status=DONE&message=BERHASIL") mode=https check-certificate=no dst-path="wifi_mark.txt"
} on-error={
    :log warning ("WIFI-APP: gagal add PPP: " . $nama)
    /tool fetch url=($proxyUrl . "?action=markCommandDone&key=" . $key . "&id=" . $cmdId . "&status=ERROR&message=GAGAL_ADD_PPP") mode=https check-certificate=no dst-path="wifi_mark.txt"
}
