USE PrinterMap;
DROP PROCEDURE IF EXISTS GetPrinterClusters;
DELIMITER // 
CREATE PROCEDURE GetPrinterClusters( IN latA FLOAT, IN latB FLOAT, IN lngA FLOAT, IN lngB FLOAT, IN gridSize INT) 
BEGIN
DECLARE m INT DEFAULT 1;
DECLARE n INT DEFAULT 1;
DECLARE fullLatDistance FLOAT;
DECLARE fullLngDistance FLOAT;
DECLARE latDistance FLOAT;
DECLARE lngDistance FLOAT;
DECLARE startLat FLOAT;
DECLARE startLng FLOAT;
DECLARE endLat FLOAT;
DECLARE endLng FLOAT;
DECLARE avgLat FLOAT;
DECLARE avgLng FLOAT;
DECLARE nLibraries INT;
CREATE TEMPORARY TABLE temp_result (
lat FLOAT,
lng FLOAT,
count INT
);
WHILE m < gridSize DO 
WHILE n < gridSize DO # magichappens 
SET fullLatDistance = latB - latA;
SET fullLngDistance = lngB - lngA;
SET latDistance = fullLatDistance / gridSize;
#SET	latDistance = latDistance*m;
SET lngDistance = fullLngDistance / gridSize;
#SET lngDistance = lngDistance*n;
SET startLat = latA + (latDistance * (n-1));
SET startLng = lngA + (lngDistance * (m-1));
SET endLat = startLat + latDistance;
SET endLng = startLng + lngDistance;
CREATE TEMPORARY TABLE IF NOT EXISTS avgs AS (
	SELECT
	AVG(lat) as lat,
	AVG(lng) as lng,
	COUNT(*) as count 
	FROM
	libraries 
	WHERE
	lat > startLat 
	AND lat < endLat 
	AND lng > startLng 
	AND lng < endLng
	);
SET avgLat = (
    SELECT
    lat 
    FROM
    avgs
    );
SET avgLng = (
    SELECT
    lng 
    FROM
    avgs
    );
SET nLibraries = (
    SELECT
    count 
    FROM
    avgs
    );
DROP TEMPORARY TABLE IF EXISTS avgs;
INSERT INTO temp_result (lat, lng, count)
SELECT
lat,
lng,
nLibraries as count 
FROM
libraries 
WHERE
lat < endLat 
AND lat > startLat 
AND lng < endLng 
AND lng > startLng 
ORDER BY
ABS(lat - avgLat),
ABS(lng - avgLng) LIMIT 1;
# macigends 
SET
n= n + 1;
END WHILE;
SET
m= m + 1;
END WHILE;
SELECT * FROM temp_result;
END//
DELIMITER ;