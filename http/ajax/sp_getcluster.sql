USE PrinterMap;
DROP PROCEDURE IF EXISTS GetPrinterCluster;
DELIMITER // 
CREATE PROCEDURE GetPrinterCluster( IN latA FLOAT, IN latB FLOAT, IN lngA FLOAT, IN lngB FLOAT) 
BEGIN
SELECT lat,lng,country FROM libraries WHERE lat < latA AND lat >= latB AND lng < lngA AND lng >= lngB ORDER BY country;
END//
DELIMITER ;