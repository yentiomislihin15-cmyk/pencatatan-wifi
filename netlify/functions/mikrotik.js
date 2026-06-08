# ==================================================
# WIFI-APP - AMBIL COMMAND DARI NETLIFY FUNCTION
# RouterOS 6.x
#
# FORMAT COMMAND STABIL:
# OK|CMD_ID|TIPE|NAMA|PASSWORD|PROFIL
#
# Contoh:
# OK|CMD-001|ADD_PPP|ANDI|12345|1 Day
# OK|CMD-002|PERPANJANG|ANDI||7 Day
# OK|CMD-003|SYNC_EXPIRE|||
#
# Support:
# 1. ADD_PPP      = tambah PPP Secret baru
# 2. PERPANJANG   = update profile PPP Secret + remove active connection
# 3. SYNC_EXPIRE  = scan PPP Secret dengan profile="Expire"
# ==================================================

:local apiUrl "https://pencatatan-wifi.netlify.app/.netlify/functions/mikrotik"
:local key "tandonetwork123"

/log info "WIFI-APP: mulai ambil command"

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

/log info ("WIFI-APP: response = ".$data)

# ==================================================
# PARSE FORMAT STABIL
# OK|CMD_ID|TIPE|NAMA|PASSWORD|PROFIL
# ==================================================

:local p1 [:find $data "|"]
:local p2 [:find $data "|" ($p1 + 1)]
:local p3 [:find $data "|" ($p2 + 1)]
:local p4 [:find $data "|" ($p3 + 1)]
:local p5 [:find $data "|" ($p4 + 1)]

:if ([:typeof $p1] = "nil") do={ /log warning ("WIFI-APP: format rusak p1: ".$data); :return }
:if ([:typeof $p2] = "nil") do={ /log warning ("WIFI-APP: format rusak p2: ".$data); :return }
:if ([:typeof $p3] = "nil") do={ /log warning ("WIFI-APP: format rusak p3: ".$data); :return }
:if ([:typeof $p4] = "nil") do={ /log warning ("WIFI-APP: format rusak p4: ".$data); :return }
:if ([:typeof $p5] = "nil") do={ /log warning ("WIFI-APP: format rusak p5: ".$data); :return }

:local cmdId [:pick $data ($p1 + 1) $p2]
:local tipe [:pick $data ($p2 + 1) $p3]
:local nama [:pick $data ($p3 + 1) $p4]
:local pass [:pick $data ($p4 + 1) $p5]
:local profil [:pick $data ($p5 + 1) [:len $data]]

/log info ("WIFI-APP: cmdId=".$cmdId." tipe=".$tipe." nama=".$nama." profil=".$profil)

# ==================================================
# SYNC_EXPIRE
# Cari PPP Secret yang Profile = Expire
# Kirim data ke Sheet PelangganMikroTik
# Format data: NAMA~PROFILE;NAMA~PROFILE;
# ==================================================

:if ($tipe = "SYNC_EXPIRE") do={
  :local syncData ""
  :local jumlah 0

  /log info "WIFI-APP: mulai sync expire profile=Expire"

  :foreach i in=[/ppp secret find where profile="Expire"] do={
    :local n [/ppp secret get $i name]
    :local pr [/ppp secret get $i profile]

    :if ([:len $n] > 0) do={
      :set syncData ($syncData.$n."~".$pr.";")
      :set jumlah ($jumlah + 1)
    }
  }

  /log info ("WIFI-APP: data expire ditemukan=".$jumlah)

  :local sendResult [/tool fetch url=$apiUrl mode=https check-certificate=no output=user as-value http-method=post http-data=("action=saveSyncExpire&key=".$key."&id=".$cmdId."&data=".$syncData)]

  :if (($sendResult->"status") = "finished") do={
    /log info ("WIFI-APP: sync expire terkirim jumlah=".$jumlah)
  } else={
    /log warning "WIFI-APP: gagal kirim sync expire"
  }

  :return
}

# ==================================================
# PERPANJANG
# Update profile PPP Secret, aktifkan, remove active connection
# ==================================================

:if ($tipe = "PERPANJANG") do={
  :if ([:len [/ppp secret find where name=$nama]] = 0) do={
    /log warning ("WIFI-APP: PPP tidak ditemukan: ".$nama)
    /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=ERROR&message=PPP_TIDAK_DITEMUKAN")
    :return
  }

  :if ([:len [/ppp profile find where name=$profil]] = 0) do={
    /log warning ("WIFI-APP: profile tidak ditemukan: ".$profil)
    /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=ERROR&message=PROFILE_TIDAK_DITEMUKAN")
    :return
  }

  :do {
    /ppp secret set [find where name=$nama] profile=$profil disabled=no

    :if ([:len [/ppp active find where name=$nama]] > 0) do={
      /ppp active remove [find where name=$nama]
      /log info ("WIFI-APP: active connection diremove: ".$nama)
    }

    /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=DONE&message=PERPANJANG_BERHASIL")
    /log info ("WIFI-APP: perpanjang berhasil ".$nama." -> ".$profil)
  } on-error={
    /log warning ("WIFI-APP: gagal perpanjang PPP: ".$nama)
    /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=ERROR&message=GAGAL_PERPANJANG")
  }

  :return
}

# ==================================================
# ADD_PPP
# Tambah PPP Secret baru
# ==================================================

:if ($tipe = "ADD_PPP") do={
  :if ([:len [/ppp profile find where name=$profil]] = 0) do={
    /log warning ("WIFI-APP: profile tidak ditemukan: ".$profil)
    /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=ERROR&message=PROFILE_TIDAK_DITEMUKAN")
    :return
  }

  :if ([:len [/ppp secret find where name=$nama]] > 0) do={
    /log warning ("WIFI-APP: PPP sudah ada, skip: ".$nama)
    /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=DONE&message=PPP_SUDAH_ADA")
    :return
  }

  :do {
    /ppp secret add name=$nama password=$pass profile=$profil service=pppoe comment="created-by-wifi-app"
    /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=DONE&message=ADD_PPP_BERHASIL")
    /log info ("WIFI-APP: PPP berhasil dibuat ".$nama)
  } on-error={
    /log warning ("WIFI-APP: gagal add PPP: ".$nama)
    /tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=ERROR&message=GAGAL_ADD_PPP")
  }

  :return
}

# ==================================================
# TIPE COMMAND TIDAK DIKENAL
# ==================================================

/log warning ("WIFI-APP: tipe command tidak dikenal: ".$tipe)
/tool fetch url=$apiUrl mode=https check-certificate=no output=user http-method=post http-data=("action=markCommandDone&key=".$key."&id=".$cmdId."&status=ERROR&message=TIPE_COMMAND_TIDAK_DIKENAL")
