# SCRIPT MIKROTIK - AMBIL COMMAND DARI NETLIFY FUNCTION
# RouterOS 6.x
#
# Jalur:
# MikroTik -> Netlify Function -> Apps Script -> Sheet
#
# Support command:
# 1. ADD_PPP     = membuat PPP Secret baru
# 2. PERPANJANG  = update profile PPP Secret + remove active connection agar reconnect
# 3. SYNC_EXPIRE = scan PPP Secret disabled=yes lalu kirim daftar expire ke Sheet

:local apiUrl "https://pencatatan-wifi.netlify.app/.netlify/functions/mikrotik"
:local key "tandonetwork123"

:local fetchResult [/tool fetch url=$apiUrl mode=https check-certificate=no output=user as-value http-method=post http-data=("action=getPendingCommand&key=".$key)]

:if (($fetchResult->"status") != "finished") do={
  /log warning "WIFI-APP: gagal fetch getPendingCommand"
  :return
}

:local data ($fetchResult->"data")

:if ($data = "") do={
  /log warning "WIFI-APP: response kosong"
  :return
}

:if ($data = "EMPTY") do={
  /log info "WIFI-APP: tidak ada pending command"
  :return
}

:if ([:pick $data 0 3] != "OK|") do={
  /log warning ("WIFI-APP: response tidak dikenal: ".$data)
  :return
}

# Format baru:
# OK|ID|NAMA|PASSWORD|PROFIL|TIPE
# TIPE = ADD_PPP / PERPANJANG
:local rest [:pick $data 3 [:len $data]]

:local p1 [:find $rest "|"]
:if ([:typeof $p1] = "nil") do={ /log warning ("WIFI-APP: format rusak: ".$data); :return }
:local cmdId [:pick $rest 0 $p1]
:set rest [:pick $rest ($p1 + 1) [:len $rest]]

:local p2 [:find $rest "|"]
:if ([:typeof $p2] = "nil") do={ /log warning ("WIFI-APP: format rusak: ".$data); :return }
:local nama [:pick $rest 0 $p2]
:set rest [:pick $rest ($p2 + 1) [:len $rest]]

:local p3 [:find $rest "|"]
:if ([:typeof $p3] = "nil") do={ /log warning ("WIFI-APP: format rusak: ".$data); :return }
:local pass [:pick $rest 0 $p3]
:set rest [:pick $rest ($p3 + 1) [:len $rest]]

:local p4 [:find $rest "|"]
:local profil ""
:local tipe "ADD_PPP"

:if ([:typeof $p4] = "nil") do={
  :set profil $rest
} else={
  :set profil [:pick $rest 0 $p4]
  :set tipe [:pick $rest ($p4 + 1) [:len $rest]]
}


:if ($tipe = "SYNC_EXPIRE") do={
  :local syncData ""
  :local jumlah 0

  :foreach i in=[/ppp secret find where disabled=yes] do={
    :local n [/ppp secret get $i name]
    :local pr [/ppp secret get $i profile]
    :if ([:len $n] > 0) do={
      :set syncData ($syncData.$n."~".$pr.";")
      :set jumlah ($jumlah + 1)
    }
  }

  :do {
    /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=saveSyncExpire&key=".$key."&id=".$cmdId."&data=".$syncData)
    /log info ("WIFI-APP: sinkron expire selesai, jumlah: ".$jumlah)
  } on-error={
    /log warning "WIFI-APP: gagal kirim data sync expire"
    /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=ERROR&message=GAGAL_SYNC_EXPIRE")
  }
  :return
}

:if ([:len [/ppp profile find name=$profil]] = 0) do={
  /log warning ("WIFI-APP: profile tidak ditemukan: ".$profil)
  /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=ERROR&message=PROFILE_TIDAK_DITEMUKAN")
  :return
}

:if ($tipe = "PERPANJANG") do={
  :if ([:len [/ppp secret find where name=$nama]] = 0) do={
    /log warning ("WIFI-APP: PPP tidak ditemukan untuk perpanjang: ".$nama)
    /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=ERROR&message=PPP_TIDAK_DITEMUKAN")
    :return
  }

  :do {
    /ppp secret set [find where name=$nama] profile=$profil disabled=no

    :if ([:len [/ppp active find where name=$nama]] > 0) do={
      /ppp active remove [find where name=$nama]
    }

    /log info ("WIFI-APP: paket berhasil diperpanjang: ".$nama." -> ".$profil)
    /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=DONE&message=PERPANJANG_BERHASIL")
  } on-error={
    /log warning ("WIFI-APP: gagal perpanjang PPP: ".$nama)
    /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=ERROR&message=GAGAL_PERPANJANG")
  }
  :return
}

# Default: ADD_PPP
:if ([:len [/ppp secret find where name=$nama]] > 0) do={
  /log warning ("WIFI-APP: PPP sudah ada, skip: ".$nama)
  /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=DONE&message=PPP_SUDAH_ADA")
  :return
}

:do {
  /ppp secret add name=$nama password=$pass profile=$profil service=pppoe comment="created-by-wifi-app"
  /log info ("WIFI-APP: PPP berhasil dibuat: ".$nama)
  /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=DONE&message=ADD_PPP_BERHASIL")
} on-error={
  /log warning ("WIFI-APP: gagal add PPP: ".$nama)
  /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=ERROR&message=GAGAL_ADD_PPP")
}
