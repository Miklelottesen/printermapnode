<?php
function sendQuery($query){
	$servername = "35.187.104.229:3306";
	$username = "root";
	$password = "pGYuzxvF";
	$dbname = "PrinterMap";

	// Create connection
	$conn = mysqli_connect($servername, $username, $password, $dbname);
	// Check connection
	if (mysqli_connect_errno()) {
	    die("Connection failed: " . mysqli_connect_error());
	} 
//	$result = [];
	$result = $conn->query($query);

	$conn->close();
	//echo $result;
	//print_r($result);
	return $result;
}
function sendMultiQuery($query){
	$servername = "35.187.104.229:3306";
	$username = "root";
	$password = "pGYuzxvF";
	$dbname = "PrinterMap";

	// Create connection
	$conn = mysqli_connect($servername, $username, $password, $dbname);
	// Check connection
	if (mysqli_connect_errno()) {
	    die("Connection failed: " . mysqli_connect_error());
	} 
	$result = [];

	// Execute multi query
	if (mysqli_multi_query($conn,$query))
	{
	  do
	    {
	    // Store first result set
	    if ($presult=mysqli_store_result($conn)) {
	      // Fetch one and one row
	      while ($row=mysqli_fetch_row($presult))
	        {
	        //printf("%s\n",$row[0]);
	        	if($row[2] != "0")
	        		array_push($result, $row);
	        }
	      // Free result set
	      mysqli_free_result($presult);
	      }
	    }
	  while (mysqli_next_result($conn));
	}
	else
		$result = $conn->query($query);

	$conn->close();
	//echo $result;
	//print_r($result);
	return $result;
}
?>