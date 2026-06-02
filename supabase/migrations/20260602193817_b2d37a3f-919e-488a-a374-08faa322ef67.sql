UPDATE public.motoristas SET status = 'Offline' WHERE codigo = 'M0001' AND status <> 'Bloqueado';
UPDATE public.motorista_auth SET device_id = NULL, device_nome = NULL WHERE motorista_codigo = 'M0001';
UPDATE public.motorista_sessoes SET status = 'encerrada' WHERE motorista_codigo = 'M0001' AND status = 'ativa';