# Prueba local de AMI

Este listener mantiene una conexión persistente con Asterisk, hace login,
solicita los canales activos y muestra eventos AMI de llamadas. No guarda datos
en una base ni implementa tarifas.

## Configuración local

Crea `.env.local` en la raíz del proyecto. Ese archivo está ignorado por Git.

```dotenv
AMI_HOST=192.168.2.194
AMI_PORT=5038
AMI_USERNAME=admin
AMI_SECRET=pon-el-secreto-solo-aqui

# Opcionales
AMI_CONNECT_TIMEOUT_MS=10000
AMI_RECONNECT_MAX_MS=30000
# 0 = listar canales una vez después del login
AMI_LIST_INTERVAL_MS=0
```

Ejecuta:

```bash
pnpm asterisk:ami
```

Déjalo ejecutándose y realiza una llamada. Deberías ver el login, la acción
`CoreShowChannels` y eventos como `Newchannel`, `DialBegin`, `BridgeEnter`,
`DialEnd` y `Hangup`. Finaliza con `Ctrl+C`.

## Configuración AMI en Asterisk

El usuario necesita recibir eventos de llamadas y ejecutar únicamente la acción
de consulta de canales:

```ini
[factel_reader]
secret = usa-un-secreto-nuevo
read = call
write = call
permit = IP_DEL_EQUIPO_QUE_EJECUTA_FACTEL/255.255.255.255
```

Después de modificar `manager.conf`, recarga AMI:

```bash
asterisk -rx "manager reload"
asterisk -rx "manager show user factel_reader"
```

No expongas el puerto 5038 a Internet. Usa una red privada, VPN, túnel SSH o
una regla de firewall limitada al equipo que ejecuta el listener.

## Docker Swarm más adelante

El proceso debe ejecutarse como un servicio de larga duración con las mismas
variables de entorno como secretos de Docker/Swarm. La imagen necesita salida
TCP hacia `192.168.2.194:5038` y acceso de lectura al CSV si ese archivo se
monta en el contenedor. El primer paso local no necesita Docker.
