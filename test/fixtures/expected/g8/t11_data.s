	.file	1 "t11_data.c"
gcc2_compiled.:
__gnu_compiled_c:
	.globl	g_int
	.sdata
	.align	2
g_int:
	.word	7
	.align	2
s_int:
	.word	9
	.globl	g_small
	.align	2
g_small:
	.half	1
	.half	2
	.half	3
	.globl	g_str
	.rdata
	.align	2
$LC0:
	.ascii	"hello world\000"
	.sdata
	.align	2
g_str:
	.word	$LC0
	.globl	g_dbl
	.align	3
g_dbl:
	.word	0xf01b866e		# 3.1415899999999998826
	.word	0x400921f9
	.globl	g_flt
	.align	2
g_flt:
	.word	0x40200000		# 2.5 (float)
	.text
	.align	2
	.globl	use_globals
	.sdata
	.align	2
$LC1:
	.ascii	"literal\000"
	.text
	.align	2
	.globl	get_str
	.align	2
	.globl	get_dbl
	.align	2
	.globl	get_flt
	.align	2
	.globl	float_cmp
	.align	2
	.globl	to_int
	.align	2
	.globl	from_int
	.align	2
	.globl	consts

	.comm	g_arr,100

	.text
	.text
	.ent	use_globals
use_globals:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lui	$3,%hi(g_arr) # high
	addiu	$3,$3,%lo(g_arr) # low
	addu	$3,$4,$3
	andi	$4,$4,0x0001
	sll	$4,$4,1
	lw	$5,g_int
	lw	$2,s_int
	lbu	$3,0($3)
	addu	$5,$5,$2
	la	$2,g_small
	addu	$4,$4,$2
	lh	$2,0($4)
	addu	$5,$5,$3
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$5,$2
	.set	macro
	.set	reorder

	.end	use_globals
	.text
	.ent	get_str
get_str:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lui	$2,%hi($LC1) # high
	.set	noreorder
	.set	nomacro
	j	$31
	addiu	$2,$2,%lo($LC1) # low
	.set	macro
	.set	reorder

	.end	get_str
	.text
	.ent	get_dbl
get_dbl:
	.frame	$sp,24,$31		# vars= 0, regs= 1/0, args= 16, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	lw	$4,g_dbl
	lw	$5,g_dbl+4
	subu	$sp,$sp,24
	sw	$31,16($sp)
	move	$6,$4
	.set	noreorder
	.set	nomacro
	jal	__adddf3
	move	$7,$5
	.set	macro
	.set	reorder

	lw	$31,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	get_dbl
	.text
	.ent	get_flt
get_flt:
	.frame	$sp,24,$31		# vars= 0, regs= 1/0, args= 16, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	lw	$5,g_flt
	subu	$sp,$sp,24
	sw	$31,16($sp)
	jal	__addsf3
	lw	$31,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	get_flt
	.text
	.ent	float_cmp
float_cmp:
	.frame	$sp,24,$31		# vars= 0, regs= 1/0, args= 16, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	subu	$sp,$sp,24
	sw	$31,16($sp)
	jal	__ltsf2
	lw	$31,16($sp)
	srl	$2,$2,31
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	float_cmp
	.text
	.ent	to_int
to_int:
	.frame	$sp,24,$31		# vars= 0, regs= 1/0, args= 16, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	subu	$sp,$sp,24
	sw	$31,16($sp)
	jal	__fixdfsi
	lw	$31,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	to_int
	.text
	.ent	from_int
from_int:
	.frame	$sp,24,$31		# vars= 0, regs= 1/0, args= 16, extra= 0
	.mask	0x80000000,-8
	.fmask	0x00000000,0
	subu	$sp,$sp,24
	sw	$31,16($sp)
	jal	__floatsidf
	lw	$31,16($sp)
	#nop
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,24
	.set	macro
	.set	reorder

	.end	from_int
	.text
	.ent	consts
consts:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	li.d	$2,1.00000000000000095367e10
	j	$31
	.end	consts
